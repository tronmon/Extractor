# app.py
import os
import io
import pytesseract
import base64
from PIL import Image
from pdf2image import convert_from_path
import PyPDF2
import flask
from flask import Flask, request, render_template, jsonify, send_file
from werkzeug.utils import secure_filename
import tempfile
import subprocess
import speech_recognition as sr
# Fix import for moviepy
from moviepy.editor import VideoFileClip
from pydub import AudioSegment
from pydub.silence import split_on_silence
import time
import gc  # Import garbage collector for cleaning memory
import shutil  # For file operations
import uuid  # For generating unique identifiers

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 256 * 1024 * 1024  # 256MB max upload
app.config['ALLOWED_EXTENSIONS'] = {'pdf', 'png', 'jpg', 'jpeg', 'mp3', 'wav', 'mp4', 'avi', 'mov', 'mkv'}

# Create uploads folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Check if Tesseract is installed and accessible
try:
    pytesseract.get_tesseract_version()
    print("Tesseract is properly installed and accessible.")
except Exception as e:
    print(f"WARNING: Tesseract is not properly configured: {str(e)}")
    print("Please ensure Tesseract OCR is installed on your system.")
    # Uncomment and modify the line below for your system if needed:
    # pytesseract.pytesseract.tesseract_cmd = r'/usr/bin/tesseract'  # Linux/Mac path example
    # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Windows path example

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def is_audio_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'mp3', 'wav'}

def is_video_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'mp4', 'avi', 'mov', 'mkv'}

def extract_text_from_pdf(pdf_path):
    text_content = []
    images_text = []
    images_data = []
    
    # Try to extract text directly (for digital PDFs)
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                if text.strip():  # If text was successfully extracted
                    text_content.append({
                        'page': page_num + 1,
                        'text': text,
                        'source': 'digital'
                    })
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
    
    # Convert PDF to images and perform OCR for scanned/image-based PDFs
    try:
        images = convert_from_path(pdf_path)
        for i, image in enumerate(images):
            # Save image temporarily
            img_io = io.BytesIO()
            image.save(img_io, format='PNG')
            img_io.seek(0)
            img_data = base64.b64encode(img_io.getvalue()).decode('utf-8')
            
            # Store image data
            images_data.append({
                'page': i + 1,
                'data': f"data:image/png;base64,{img_data}"
            })
            
            # If we didn't get text from direct extraction, use OCR
            if i >= len(text_content) or not text_content[i]['text'].strip():
                # Add OCR configuration
                custom_config = r'--oem 3 --psm 6'  # OCR Engine Mode 3 = default, Page Segmentation Mode 6 = assume single block of text
                text = pytesseract.image_to_string(image, lang='eng', config=custom_config)
                
                if not text.strip():
                    # Try a different PSM mode if first one didn't work
                    custom_config = r'--oem 3 --psm 11'  # PSM 11 = sparse text with OSD
                    text = pytesseract.image_to_string(image, lang='eng', config=custom_config)
                
                images_text.append({
                    'page': i + 1,
                    'text': text,
                    'source': 'ocr'
                })
    except Exception as e:
        print(f"Error processing images in PDF: {e}")
    
    # Combine results, preferring digital text when available
    result = []
    for i in range(max(len(text_content), len(images_text), len(images_data))):
        page_data = {
            'page': i + 1,
            'text': "No text could be extracted from this page.",
            'source': 'none',
            'image': images_data[i]['data'] if i < len(images_data) else None
        }
        
        if i < len(text_content) and text_content[i]['text'].strip():
            page_data.update({
                'text': text_content[i]['text'],
                'source': 'digital'
            })
        elif i < len(images_text) and images_text[i]['text'].strip():
            page_data.update({
                'text': images_text[i]['text'],
                'source': 'ocr'
            })
            
        result.append(page_data)
            
    return result

def extract_text_from_image(image_path):
    try:
        # Open the image with PIL
        image = Image.open(image_path)
        
        # Convert image to RGB mode if it's not already (handles RGBA, etc.)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Get base64 of image for display
        img_io = io.BytesIO()
        image.save(img_io, format='PNG')
        img_io.seek(0)
        img_data = base64.b64encode(img_io.getvalue()).decode('utf-8')
        img_src = f"data:image/png;base64,{img_data}"
        
        # Extract text using Tesseract with enhanced configuration
        custom_config = r'--oem 3 --psm 6'  # OCR Engine Mode 3 = default, Page Segmentation Mode 6 = assume single block of text
        text = pytesseract.image_to_string(image, lang='eng', config=custom_config)
        
        if not text.strip():
            # If no text was extracted, try different PSM mode
            custom_config = r'--oem 3 --psm 11'  # PSM 11 = sparse text with OSD
            text = pytesseract.image_to_string(image, lang='eng', config=custom_config)
            
            # If still no text, try another PSM mode
            if not text.strip():
                custom_config = r'--oem 3 --psm 3'  # PSM 3 = fully automatic page segmentation
                text = pytesseract.image_to_string(image, lang='eng', config=custom_config)
        
        if text.strip():
            return [{
                'page': 1,
                'text': text,
                'source': 'ocr',
                'image': img_src
            }]
        else:
            return [{
                'page': 1,
                'text': "No text could be detected in this image.",
                'source': 'ocr',
                'image': img_src
            }]
            
    except Exception as e:
        print(f"Error extracting text from image: {str(e)}")
        # Still return the image if possible, even if text extraction failed
        try:
            if 'img_src' in locals():
                return [{
                    'page': 1,
                    'text': f"Error extracting text from image: {str(e)}",
                    'source': 'error',
                    'image': img_src
                }]
            else:
                # Try to get image data even after error
                try:
                    image = Image.open(image_path)
                    img_io = io.BytesIO()
                    image.save(img_io, format='PNG')
                    img_io.seek(0)
                    img_data = base64.b64encode(img_io.getvalue()).decode('utf-8')
                    img_src = f"data:image/png;base64,{img_data}"
                    
                    return [{
                        'page': 1,
                        'text': f"Error extracting text from image: {str(e)}",
                        'source': 'error',
                        'image': img_src
                    }]
                except:
                    return [{
                        'page': 1,
                        'text': f"Error extracting text from image: {str(e)}",
                        'source': 'error',
                        'image': None
                    }]
        except:
            # Fallback if everything fails
            return [{
                'page': 1,
                'text': "Error processing image.",
                'source': 'error',
                'image': None
            }]

def extract_text_from_audio(audio_path):
    """Extract text from audio file using speech recognition"""
    try:
        # Initialize recognizer
        r = sr.Recognizer()
        
        # Get audio file extension
        file_ext = os.path.splitext(audio_path)[1].lower()
        
        # Create temporary directory with unique ID to avoid conflicts
        temp_dir = os.path.join(tempfile.gettempdir(), f"audio_extract_{uuid.uuid4().hex}")
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_audio_path = os.path.join(temp_dir, "preview.mp3")
        temp_wav_path = os.path.join(temp_dir, "audio.wav")
        
        try:
            # Convert audio to WAV for speech recognition if needed
            if file_ext != '.wav':
                sound = AudioSegment.from_file(audio_path)
                # Take first 30 seconds for preview
                preview = sound[:min(30000, len(sound))]
                preview.export(temp_audio_path, format="mp3")
                # Export to WAV for speech recognition
                sound.export(temp_wav_path, format="wav")
            else:
                sound = AudioSegment.from_wav(audio_path)
                # Take first 30 seconds for preview
                preview = sound[:min(30000, len(sound))]
                preview.export(temp_audio_path, format="mp3")
                # For WAV files, make a copy to avoid file locking issues
                sound.export(temp_wav_path, format="wav")
            
            # Read audio file
            with sr.AudioFile(temp_wav_path) as source:
                # Adjust for ambient noise
                r.adjust_for_ambient_noise(source)
                
                # Load audio data
                audio_data = r.record(source)
                
                # Recognize speech using Google Speech Recognition
                text = r.recognize_google(audio_data)
                
                # Get base64 of audio preview for display
                with open(temp_audio_path, 'rb') as audio_file:
                    audio_data = base64.b64encode(audio_file.read()).decode('utf-8')
                    audio_src = f"data:audio/mp3;base64,{audio_data}"
                
                return [{
                    'page': 1,
                    'text': text,
                    'source': 'speech',
                    'audio': audio_src
                }]
        finally:
            # Clean up temp files
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as cleanup_error:
                print(f"Warning: Error during cleanup: {cleanup_error}")
            
    except sr.UnknownValueError:
        return [{
            'page': 1,
            'text': "Speech recognition could not understand the audio",
            'source': 'speech',
            'audio': None
        }]
    except sr.RequestError as e:
        return [{
            'page': 1,
            'text': f"Could not request results from speech recognition service; {e}",
            'source': 'error',
            'audio': None
        }]
    except Exception as e:
        print(f"Error processing audio: {str(e)}")
        return [{
            'page': 1,
            'text': f"Error processing audio: {str(e)}",
            'source': 'error',
            'audio': None
        }]

def extract_text_from_video(video_path):
    """Extract text from video by converting to audio first with ffmpeg and then using speech recognition"""
    try:
        # Create temporary directory with unique ID to avoid conflicts
        temp_dir = os.path.join(tempfile.gettempdir(), f"video_extract_{uuid.uuid4().hex}")
        os.makedirs(temp_dir, exist_ok=True)
        
        try:
            # Make a copy of the video file to avoid file locking issues
            video_copy_path = os.path.join(temp_dir, f"video_copy{os.path.splitext(video_path)[1]}")
            shutil.copy2(video_path, video_copy_path)
            
            # Extract audio from video using ffmpeg
            audio_path = os.path.join(temp_dir, "extracted_audio.wav")
            
            # Command to extract audio using ffmpeg
            ffmpeg_cmd = [
                'ffmpeg',
                '-i', video_copy_path,
                '-q:a', '0',
                '-map', 'a',
                '-vn',
                audio_path
            ]
            
            # Execute the command
            try:
                subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            except subprocess.CalledProcessError as e:
                return [{
                    'page': 1,
                    'text': f"Error extracting audio from video: {e.stderr.decode() if e.stderr else str(e)}",
                    'source': 'error',
                    'video': None
                }]
            
            # Check if audio file was created successfully
            if not os.path.exists(audio_path) or os.path.getsize(audio_path) == 0:
                return [{
                    'page': 1,
                    'text': "No audio detected in this video file or audio extraction failed.",
                    'source': 'video',
                    'video': None
                }]
            
            # Create video preview with ffmpeg (first 15 seconds)
            preview_path = os.path.join(temp_dir, "preview.mp4")
            preview_cmd = [
                'ffmpeg',
                '-i', video_copy_path,
                '-t', '15',
                '-vf', 'scale=480:-1',  # Resize to 480px width
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-strict', 'experimental',
                '-b:a', '128k',
                preview_path
            ]
            
            try:
                subprocess.run(preview_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            except subprocess.CalledProcessError:
                # If preview creation fails, continue with just audio extraction
                preview_path = None
            
            # Extract frames for thumbnail preview (1 frame every 5 seconds, up to 5 frames)
            frames = []
            for i in range(5):
                frame_path = os.path.join(temp_dir, f"frame_{i}.jpg")
                frame_cmd = [
                    'ffmpeg',
                    '-i', video_copy_path,
                    '-ss', str(i * 5),  # Take frame every 5 seconds
                    '-frames:v', '1',
                    '-q:v', '2',
                    frame_path
                ]
                
                try:
                    subprocess.run(frame_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    if os.path.exists(frame_path):
                        with open(frame_path, 'rb') as img_file:
                            img_data = base64.b64encode(img_file.read()).decode('utf-8')
                            frames.append(f"data:image/jpeg;base64,{img_data}")
                except subprocess.CalledProcessError:
                    # If frame extraction fails, continue with what we have
                    pass
            
            # Base64 encode the video preview if available
            video_src = None
            if preview_path and os.path.exists(preview_path):
                try:
                    with open(preview_path, 'rb') as video_file:
                        video_data = base64.b64encode(video_file.read()).decode('utf-8')
                        video_src = f"data:video/mp4;base64,{video_data}"
                except Exception as e:
                    print(f"Error encoding video preview: {str(e)}")
            
            # Now process the extracted audio file
            try:
                r = sr.Recognizer()
                with sr.AudioFile(audio_path) as source:
                    r.adjust_for_ambient_noise(source)
                    audio_data = r.record(source)
                    text = r.recognize_google(audio_data)
                    
                    return [{
                        'page': 1,
                        'text': text,
                        'source': 'video',
                        'video': video_src,
                        'frames': frames
                    }]
            except sr.UnknownValueError:
                return [{
                    'page': 1,
                    'text': "Speech recognition could not understand the audio in this video",
                    'source': 'video',
                    'video': video_src,
                    'frames': frames
                }]
            except sr.RequestError as e:
                return [{
                    'page': 1,
                    'text': f"Could not request results from speech recognition service; {e}",
                    'source': 'error',
                    'video': video_src,
                    'frames': frames
                }]
            except Exception as e:
                return [{
                    'page': 1,
                    'text': f"Error processing audio from video: {str(e)}",
                    'source': 'error',
                    'video': video_src,
                    'frames': frames
                }]
                
        finally:
            # Clean up temporary files
            try:
                # Force garbage collection to free resources
                gc.collect()
                time.sleep(0.5)  # Small delay for resources to be freed
                
                # Remove the temporary directory and all its contents
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as cleanup_error:
                print(f"Warning: Error during cleanup: {cleanup_error}")
                
    except Exception as e:
        print(f"Error processing video: {str(e)}")
        return [{
            'page': 1,
            'text': f"Error processing video: {str(e)}",
            'source': 'error',
            'video': None
        }]

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/app')
def app_page():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        try:
            # Secure the filename and create a unique version to avoid conflicts
            original_filename = secure_filename(file.filename)
            unique_id = uuid.uuid4().hex[:8]
            filename = f"{os.path.splitext(original_filename)[0]}_{unique_id}{os.path.splitext(original_filename)[1]}"
            
            # Create a temporary directory for processing this file
            temp_process_dir = os.path.join(app.config['UPLOAD_FOLDER'], f"proc_{unique_id}")
            os.makedirs(temp_process_dir, exist_ok=True)
            
            # Save the uploaded file to the temporary directory
            filepath = os.path.join(temp_process_dir, filename)
            file.save(filepath)
            
            file_ext = os.path.splitext(filename)[1].lower()[1:]  # Get extension without the dot
            
            # Save a copy of the original file for download
            original_copy = os.path.join(temp_process_dir, f"original_{filename}")
            shutil.copy2(filepath, original_copy)
            
            try:
                if file_ext == 'pdf':
                    result = extract_text_from_pdf(filepath)
                    file_type = 'pdf'
                elif file_ext in ['png', 'jpg', 'jpeg']:
                    result = extract_text_from_image(filepath)
                    file_type = 'image'
                elif file_ext in ['mp3', 'wav']:
                    result = extract_text_from_audio(filepath)
                    file_type = 'audio'
                elif file_ext in ['mp4', 'avi', 'mov', 'mkv']:
                    result = extract_text_from_video(filepath)
                    file_type = 'video'
                else:
                    return jsonify({'error': 'Unsupported file type'}), 400
                
                # Create text file for download
                text_content = ""
                for page in result:
                    text_content += f"--- Page {page['page']} ({page['source']}) ---\n\n"
                    text_content += page['text'] + "\n\n"
                
                text_filename = f"{os.path.splitext(filename)[0]}_extracted.txt"
                text_filepath = os.path.join(temp_process_dir, text_filename)
                
                with open(text_filepath, 'w', encoding='utf-8') as text_file:
                    text_file.write(text_content)
                
                # Move files to the main uploads directory
                final_original = os.path.join(app.config['UPLOAD_FOLDER'], f"original_{filename}")
                final_text = os.path.join(app.config['UPLOAD_FOLDER'], text_filename)
                
                shutil.copy2(original_copy, final_original)
                shutil.copy2(text_filepath, final_text)
                
                # Clean up the temporary processing directory
                try:
                    # Force close any file handles
                    gc.collect()
                    time.sleep(0.5)  # Small delay for resources to be freed
                    
                    # Remove original file to save space
                    if os.path.exists(filepath):
                        os.remove(filepath)
                        
                    # Remove the temporary directory entirely
                    shutil.rmtree(temp_process_dir, ignore_errors=True)
                except Exception as cleanup_error:
                    print(f"Warning: Error during cleanup: {cleanup_error}")
                
                return jsonify({
                    'success': True,
                    'filename': original_filename,  # Return the original filename for display
                    'pages': result,
                    'fileType': file_type,
                    'downloadLinks': {
                        'original': f"/download/original/{filename}",
                        'text': f"/download/text/{text_filename}"
                    }
                })
                
            except Exception as e:
                # If any error occurs during processing, return error
                print(f"Error processing file: {str(e)}")
                # Clean up resources
                try:
                    shutil.rmtree(temp_process_dir, ignore_errors=True)
                except:
                    pass
                return jsonify({'error': f'Error processing file: {str(e)}'}), 500
                
        except Exception as e:
            print(f"Error handling upload: {str(e)}")
            return jsonify({'error': f'Error handling upload: {str(e)}'}), 500
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/download/original/<filename>')
def download_original(filename):
    return send_file(os.path.join(app.config['UPLOAD_FOLDER'], f"original_{filename}"), 
                     as_attachment=True, 
                     download_name=filename)

@app.route('/download/text/<filename>')
def download_text(filename):
    return send_file(os.path.join(app.config['UPLOAD_FOLDER'], filename), 
                     as_attachment=True, 
                     download_name=filename)

# Helper function to clean up old files (run periodically)
def cleanup_old_files():
    """Remove files older than 1 hour from the uploads directory"""
    try:
        now = time.time()
        for f in os.listdir(app.config['UPLOAD_FOLDER']):
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], f)
            if os.path.isfile(filepath) and os.path.exists(filepath):
                # Remove files older than 1 hour
                if os.stat(filepath).st_mtime < now - 3600:
                    try:
                        os.remove(filepath)
                    except:
                        pass
    except Exception as e:
        print(f"Error during cleanup: {e}")

@app.route('/cleanup', methods=['POST'])
def manual_cleanup():
    """Endpoint to manually trigger cleanup"""
    cleanup_old_files()
    return jsonify({'success': True, 'message': 'Cleanup completed'})

if __name__ == '__main__':
    # Clean up old files on startup
    cleanup_old_files()
    app.run(debug=True)