// static/index.js
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const fileName = document.getElementById('file-name');
    const uploadBtn = document.getElementById('upload-btn');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const filenameDisplay = document.getElementById('filename');
    const pagesContainer = document.getElementById('pages-container');
    const downloadOptions = document.getElementById('download-options');
    const downloadOriginal = document.getElementById('download-original');
    const downloadText = document.getElementById('download-text');
    const welcomePopup = document.getElementById('welcome-popup');
    const fileSelectPopup = document.getElementById('file-select-popup');
    const fileTypeOptions = document.querySelectorAll('.file-type-option');
    const fileSelectClose = document.getElementById('file-select-close');
    const themeSwitch = document.getElementById('theme-switch');
    
    // Theme toggle functionality
    themeSwitch.addEventListener('change', () => {
        if (themeSwitch.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    });
    
    // Apply saved theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeSwitch.checked = true;
    }
    
    // Welcome popup auto-close after 5 seconds
    setTimeout(() => {
        welcomePopup.style.opacity = '0';
        welcomePopup.style.pointerEvents = 'none';
        setTimeout(() => {
            welcomePopup.classList.add('hidden');
            // Show file select popup after welcome popup disappears
            showFileSelectPopup();
        }, 500);
    }, 5000);
    
    // Show file type selection popup
    function showFileSelectPopup() {
        fileSelectPopup.classList.remove('hidden');
        setTimeout(() => {
            fileSelectPopup.querySelector('.popup-content').classList.add('animate-in');
        }, 10);
    }
    
    // File type selection
    fileTypeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const fileType = option.getAttribute('data-type');
            
            // Set file input accept attribute based on selection
            if (fileType === 'pdf') {
                fileInput.setAttribute('accept', '.pdf');
            } else if (fileType === 'image') {
                fileInput.setAttribute('accept', '.png,.jpg,.jpeg');
            }
            
            // Close popup and trigger file input
            fileSelectPopup.classList.add('hidden');
            fileInput.click();
        });
    });
    
    // Close file select popup
    fileSelectClose.addEventListener('click', () => {
        fileSelectPopup.classList.add('hidden');
    });
    
    // Show file select popup when clicking the browse button directly
    document.querySelector('.browse-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFileSelectPopup();
    });
    
    // Update filename display when a file is selected
    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) {
            fileName.textContent = fileInput.files[0].name;
            // Add animation to the filename
            fileName.classList.add('animate__animated', 'animate__fadeIn');
            setTimeout(() => {
                fileName.classList.remove('animate__animated', 'animate__fadeIn');
            }, 1000);
        } else {
            fileName.textContent = 'Choose a file';
        }
    });
    
    // Handle form submission
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (fileInput.files.length === 0) {
            showNotification('Please select a file first.', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        
        // Show loading spinner
        uploadForm.classList.add('hidden');
        loading.classList.remove('hidden');
        results.classList.add('hidden');
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.error) {
                showNotification(`Error: ${data.error}`, 'error');
                uploadForm.classList.remove('hidden');
                loading.classList.add('hidden');
                return;
            }
            
            // Display results
            filenameDisplay.textContent = data.filename;
            displayResults(data.pages);
            
            // Set up download links
            if (data.downloadLinks) {
                downloadOriginal.href = data.downloadLinks.original;
                downloadText.href = data.downloadLinks.text;
                downloadOptions.classList.remove('hidden');
            }
            
            // Show results section with animation
            results.classList.remove('hidden');
            results.style.opacity = '0';
            results.style.transform = 'translateY(20px)';
            
            // Trigger reflow to ensure animation plays
            void results.offsetWidth;
            
            results.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            results.style.opacity = '1';
            results.style.transform = 'translateY(0)';
            
            showNotification('Text extracted successfully!', 'success');
        } catch (error) {
            console.error('Error uploading file:', error);
            showNotification('An error occurred while processing your file. Please try again.', 'error');
        } finally {
            // Hide loading spinner
            loading.classList.add('hidden');
            // Show form again
            uploadForm.classList.remove('hidden');
        }
    });
    
    function displayResults(pages) {
        pagesContainer.innerHTML = '';
        
        pages.forEach((page, index) => {
            const pageElement = document.createElement('div');
            pageElement.classList.add('page');
            pageElement.style.animationDelay = `${index * 0.1}s`;
            
            const pageHeader = document.createElement('div');
            pageHeader.classList.add('page-header');
            const pageTitle = document.createElement('div');
            pageTitle.classList.add('page-title');
            pageTitle.textContent = `Page ${page.page}`;
            
            const sourceTag = document.createElement('span');
            sourceTag.classList.add('source-tag');
            
            if (page.source === 'digital') {
                sourceTag.classList.add('source-digital');
                sourceTag.textContent = 'Digital Text';
            } else if (page.source === 'ocr') {
                sourceTag.classList.add('source-ocr');
                sourceTag.textContent = 'OCR Text';
            } else {
                sourceTag.classList.add('source-none');
                sourceTag.textContent = 'No Text';
            }
            
            pageHeader.appendChild(pageTitle);
            pageHeader.appendChild(sourceTag);
            
            // If there's an image, display it
            if (page.image) {
                const imageContainer = document.createElement('div');
                imageContainer.classList.add('page-image');
                
                const image = document.createElement('img');
                image.src = page.image;
                image.alt = `Page ${page.page} Image`;
                image.loading = "lazy"; // Lazy loading for better performance
                
                // Add click to enlarge functionality
                image.addEventListener('click', () => {
                    createImageModal(page.image, `Page ${page.page}`);
                });
                
                imageContainer.appendChild(image);
                pageElement.appendChild(imageContainer);
            }
            
            const textContent = document.createElement('div');
            textContent.classList.add('text-content');
            textContent.textContent = page.text;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('actions');
            
            const copyBtn = document.createElement('button');
            copyBtn.classList.add('copy-btn');
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Text';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(page.text)
                    .then(() => {
                        const originalText = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                        setTimeout(() => {
                            copyBtn.innerHTML = originalText;
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Failed to copy text:', err);
                        showNotification('Failed to copy text. Please try again.', 'error');
                    });
            });
            
            actionsDiv.appendChild(copyBtn);
            
            pageElement.appendChild(pageHeader);
            pageElement.appendChild(textContent);
            pageElement.appendChild(actionsDiv);
            
            pagesContainer.appendChild(pageElement);
        });
    }
    
    // Create image modal for enlarged view
    function createImageModal(src, title) {
        const modal = document.createElement('div');
        modal.classList.add('image-modal');
        
        const modalContent = document.createElement('div');
        modalContent.classList.add('modal-content');
        
        const modalImage = document.createElement('img');
        modalImage.src = src;
        modalImage.alt = title;
        
        const modalClose = document.createElement('button');
        modalClose.classList.add('modal-close');
        modalClose.innerHTML = '<i class="fas fa-times"></i>';
        modalClose.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        const modalTitle = document.createElement('div');
        modalTitle.classList.add('modal-title');
        modalTitle.textContent = title;
        
        modalContent.appendChild(modalClose);
        modalContent.appendChild(modalTitle);
        modalContent.appendChild(modalImage);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // Close modal when clicking outside the image
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        // Animation for modal
        setTimeout(() => {
            modal.style.opacity = '1';
            modalContent.style.transform = 'translateY(0)';
        }, 10);
    }
    
    // Toast notification system
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.classList.add('notification', `notification-${type}`);
        
        let icon = '';
        switch(type) {
            case 'success':
                icon = '<i class="fas fa-check-circle"></i>';
                break;
            case 'error':
                icon = '<i class="fas fa-exclamation-circle"></i>';
                break;
            case 'info':
                icon = '<i class="fas fa-info-circle"></i>';
                break;
        }
        
        notification.innerHTML = `
            ${icon}
            <span>${message}</span>
        `;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.classList.add('notification-close');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.addEventListener('click', () => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
        
        notification.appendChild(closeBtn);
        
        // Create notification container if it doesn't exist
        let notificationContainer = document.querySelector('.notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.classList.add('notification-container');
            document.body.appendChild(notificationContainer);
        }
        
        notificationContainer.appendChild(notification);
        
        // Animation
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    // Reset the form and results when a new file is selected
    fileInput.addEventListener('change', () => {
        results.classList.add('hidden');
        downloadOptions.classList.add('hidden');
    });
    
    // Handle drag and drop functionality
    const dropZone = document.querySelector('.custom-file-input');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropZone.classList.add('highlight');
    }
    
    function unhighlight() {
        dropZone.classList.remove('highlight');
    }
    
    dropZone.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        
        if (file) {
            // Check if file type is allowed
            const fileType = file.name.split('.').pop().toLowerCase();
            const allowedTypes = ['pdf', 'png', 'jpg', 'jpeg'];
            
            if (!allowedTypes.includes(fileType)) {
                showNotification('File type not allowed. Please select a PDF or image file.', 'error');
                return;
            }
            
            // Update file input with the dropped file
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            
            // Update file name display
            fileName.textContent = file.name;
            
            // Automatically submit the form
            uploadBtn.click();
        }
    }
    
    // Add more dynamic effects to the application
    document.querySelectorAll('.title-animation').forEach(element => {
        element.addEventListener('mouseover', () => {
            element.style.letterSpacing = '1px';
            setTimeout(() => {
                element.style.letterSpacing = '';
            }, 300);
        });
    });
});// static/index.js
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const fileName = document.getElementById('file-name');
    const uploadBtn = document.getElementById('upload-btn');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const filenameDisplay = document.getElementById('filename');
    const pagesContainer = document.getElementById('pages-container');
    const downloadOptions = document.getElementById('download-options');
    const downloadOriginal = document.getElementById('download-original');
    const downloadText = document.getElementById('download-text');
    const welcomePopup = document.getElementById('welcome-popup');
    const fileSelectPopup = document.getElementById('file-select-popup');
    const fileTypeOptions = document.querySelectorAll('.file-type-option');
    const fileSelectClose = document.getElementById('file-select-close');
    const themeSwitch = document.getElementById('theme-switch');
    
    // Theme toggle functionality
    themeSwitch.addEventListener('change', () => {
        if (themeSwitch.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    });
    
    // Apply saved theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeSwitch.checked = true;
    }
    
    // Welcome popup auto-close after 5 seconds
    setTimeout(() => {
        if (welcomePopup) {
            welcomePopup.style.opacity = '0';
            welcomePopup.style.pointerEvents = 'none';
            setTimeout(() => {
                welcomePopup.classList.add('hidden');
                // Show file select popup after welcome popup disappears
                showFileSelectPopup();
            }, 500);
        }
    }, 5000);
    
    // Show file type selection popup
    function showFileSelectPopup() {
        if (fileSelectPopup) {
            fileSelectPopup.classList.remove('hidden');
            setTimeout(() => {
                const popupContent = fileSelectPopup.querySelector('.popup-content');
                if (popupContent) {
                    popupContent.classList.add('animate-in');
                }
            }, 10);
        }
    }
    
    // File type selection
    fileTypeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const fileType = option.getAttribute('data-type');
            
            // Set file input accept attribute based on selection
            switch(fileType) {
                case 'pdf':
                    fileInput.setAttribute('accept', '.pdf');
                    break;
                case 'image':
                    fileInput.setAttribute('accept', '.png,.jpg,.jpeg,.gif,.webp');
                    break;
                case 'audio':
                    fileInput.setAttribute('accept', '.mp3,.wav,.ogg,.flac,.aac,.m4a');
                    break;
                case 'video':
                    fileInput.setAttribute('accept', '.mp4,.avi,.mov,.mkv,.webm');
                    break;
                default:
                    fileInput.setAttribute('accept', '.pdf,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.ogg,.flac,.aac,.m4a,.mp4,.avi,.mov,.mkv,.webm');
            }
            
            // Close popup and trigger file input
            fileSelectPopup.classList.add('hidden');
            fileInput.click();
        });
    });
    
    // Close file select popup
    if (fileSelectClose) {
        fileSelectClose.addEventListener('click', () => {
            fileSelectPopup.classList.add('hidden');
        });
    }
    
    // Show file select popup when clicking the browse button directly
    const browseBtn = document.querySelector('.browse-btn');
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showFileSelectPopup();
        });
    }
    
    // Update filename display when a file is selected
    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) {
            fileName.textContent = fileInput.files[0].name;
            // Add animation to the filename
            fileName.classList.add('animate__animated', 'animate__fadeIn');
            setTimeout(() => {
                fileName.classList.remove('animate__animated', 'animate__fadeIn');
            }, 1000);
            
            // Show file type icon based on file extension
            updateFileIcon(fileInput.files[0]);
        } else {
            fileName.textContent = 'Choose a file';
        }
    });
    
    // Update file icon based on file type
    function updateFileIcon(file) {
        const fileIconElement = document.getElementById('file-icon');
        if (!fileIconElement) return;
        
        const fileType = file.type.split('/')[0];
        const extension = file.name.split('.').pop().toLowerCase();
        
        // Reset classes
        fileIconElement.className = 'file-icon';
        
        // Add appropriate icon class
        if (fileType === 'application' && extension === 'pdf') {
            fileIconElement.classList.add('pdf-icon');
            fileIconElement.innerHTML = '<i class="fas fa-file-pdf"></i>';
        } else if (fileType === 'image') {
            fileIconElement.classList.add('image-icon');
            fileIconElement.innerHTML = '<i class="fas fa-file-image"></i>';
        } else if (fileType === 'audio') {
            fileIconElement.classList.add('audio-icon');
            fileIconElement.innerHTML = '<i class="fas fa-file-audio"></i>';
        } else if (fileType === 'video') {
            fileIconElement.classList.add('video-icon');
            fileIconElement.innerHTML = '<i class="fas fa-file-video"></i>';
        } else {
            fileIconElement.innerHTML = '<i class="fas fa-file"></i>';
        }
    }
    
    // Handle form submission
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (fileInput.files.length === 0) {
            showNotification('Please select a file first.', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        
        // Show loading spinner
        uploadForm.classList.add('hidden');
        loading.classList.remove('hidden');
        results.classList.add('hidden');
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                showNotification(`Error: ${data.error}`, 'error');
                uploadForm.classList.remove('hidden');
                loading.classList.add('hidden');
                return;
            }
            
            // Display results
            filenameDisplay.textContent = data.filename;
            displayResults(data.pages, data.fileType);
            
            // Set up download links
            if (data.downloadLinks) {
                downloadOriginal.href = data.downloadLinks.original;
                downloadText.href = data.downloadLinks.text;
                downloadOptions.classList.remove('hidden');
            }
            
            // Show results section with animation
            results.classList.remove('hidden');
            results.style.opacity = '0';
            results.style.transform = 'translateY(20px)';
            
            // Trigger reflow to ensure animation plays
            void results.offsetWidth;
            
            results.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            results.style.opacity = '1';
            results.style.transform = 'translateY(0)';
            
            showNotification('Content extracted successfully!', 'success');
        } catch (error) {
            console.error('Error uploading file:', error);
            showNotification('An error occurred while processing your file. Please try again.', 'error');
        } finally {
            // Hide loading spinner
            loading.classList.add('hidden');
            // Show form again
            uploadForm.classList.remove('hidden');
        }
    });
    
    function displayResults(pages, fileType) {
        pagesContainer.innerHTML = '';
        
        pages.forEach((page, index) => {
            const pageElement = document.createElement('div');
            pageElement.classList.add('page');
            pageElement.style.animationDelay = `${index * 0.1}s`;
            
            const pageHeader = document.createElement('div');
            pageHeader.classList.add('page-header');
            const pageTitle = document.createElement('div');
            pageTitle.classList.add('page-title');
            
            // Set appropriate title based on file type
            if (fileType === 'audio') {
                pageTitle.textContent = `Audio Track ${page.page}`;
            } else if (fileType === 'video') {
                pageTitle.textContent = `Video Segment ${page.page}`;
            } else {
                pageTitle.textContent = `Page ${page.page}`;
            }
            
            const sourceTag = document.createElement('span');
            sourceTag.classList.add('source-tag');
            
            if (page.source === 'digital') {
                sourceTag.classList.add('source-digital');
                sourceTag.textContent = 'Digital Text';
            } else if (page.source === 'ocr') {
                sourceTag.classList.add('source-ocr');
                sourceTag.textContent = 'OCR Text';
            } else if (page.source === 'speech') {
                sourceTag.classList.add('source-speech');
                sourceTag.textContent = 'Speech-to-Text';
            } else if (page.source === 'video') {
                sourceTag.classList.add('source-video');
                sourceTag.textContent = 'Video Speech-to-Text';
            } else {
                sourceTag.classList.add('source-none');
                sourceTag.textContent = 'No Text';
            }
            
            pageHeader.appendChild(pageTitle);
            pageHeader.appendChild(sourceTag);
            pageElement.appendChild(pageHeader);
            
            // Add media previews based on file type
            if (fileType === 'image' && page.image) {
                const imageContainer = document.createElement('div');
                imageContainer.classList.add('page-image');
                
                const image = document.createElement('img');
                image.src = page.image;
                image.alt = `Page ${page.page} Image`;
                image.loading = "lazy"; // Lazy loading for better performance
                
                // Add click to enlarge functionality
                image.addEventListener('click', () => {
                    createImageModal(page.image, `Page ${page.page}`);
                });
                
                imageContainer.appendChild(image);
                pageElement.appendChild(imageContainer);
            } else if (fileType === 'audio' && page.audio) {
                const audioContainer = document.createElement('div');
                audioContainer.classList.add('page-audio');
                
                // Create waveform visualization for audio
                const waveformDiv = document.createElement('div');
                waveformDiv.classList.add('audio-waveform');
                waveformDiv.id = `waveform-${index}`;
                audioContainer.appendChild(waveformDiv);
                
                // Add audio player with enhanced controls
                const audioPlayer = document.createElement('div');
                audioPlayer.classList.add('audio-player');
                
                const audio = document.createElement('audio');
                audio.id = `audio-${index}`;
                audio.controls = true;
                audio.src = page.audio;
                audio.preload = "metadata";
                
                // Add custom play button
                const playButton = document.createElement('button');
                playButton.classList.add('play-button');
                playButton.innerHTML = '<i class="fas fa-play"></i>';
                playButton.addEventListener('click', () => {
                    if (audio.paused) {
                        audio.play();
                        playButton.innerHTML = '<i class="fas fa-pause"></i>';
                    } else {
                        audio.pause();
                        playButton.innerHTML = '<i class="fas fa-play"></i>';
                    }
                });
                
                // Add time display
                const timeDisplay = document.createElement('div');
                timeDisplay.classList.add('time-display');
                timeDisplay.innerHTML = '0:00 / 0:00';
                
                // Add progress bar
                const progressContainer = document.createElement('div');
                progressContainer.classList.add('progress-container');
                
                const progressBar = document.createElement('div');
                progressBar.classList.add('progress-bar');
                
                const progress = document.createElement('div');
                progress.classList.add('progress');
                
                progressBar.appendChild(progress);
                progressContainer.appendChild(progressBar);
                
                // Update progress bar and time display when audio plays
                audio.addEventListener('timeupdate', () => {
                    const currentTime = formatTime(audio.currentTime);
                    const duration = formatTime(audio.duration);
                    timeDisplay.innerHTML = `${currentTime} / ${duration}`;
                    
                    const progressPercent = (audio.currentTime / audio.duration) * 100;
                    progress.style.width = `${progressPercent}%`;
                });
                
                // Allow clicking on progress bar to seek
                progressContainer.addEventListener('click', (e) => {
                    const percent = e.offsetX / progressContainer.offsetWidth;
                    audio.currentTime = percent * audio.duration;
                });
                
                // Update button when audio ends
                audio.addEventListener('ended', () => {
                    playButton.innerHTML = '<i class="fas fa-play"></i>';
                });
                
                // Add audio speed control
                const speedControl = document.createElement('select');
                speedControl.classList.add('speed-control');
                
                const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
                speeds.forEach(speed => {
                    const option = document.createElement('option');
                    option.value = speed;
                    option.textContent = `${speed}x`;
                    if (speed === 1.0) option.selected = true;
                    speedControl.appendChild(option);
                });
                
                speedControl.addEventListener('change', () => {
                    audio.playbackRate = parseFloat(speedControl.value);
                });
                
                // Assemble audio player controls
                const controlsContainer = document.createElement('div');
                controlsContainer.classList.add('audio-controls');
                controlsContainer.appendChild(playButton);
                controlsContainer.appendChild(progressContainer);
                controlsContainer.appendChild(timeDisplay);
                controlsContainer.appendChild(speedControl);
                
                audioPlayer.appendChild(audio);
                audioPlayer.appendChild(controlsContainer);
                audioContainer.appendChild(audioPlayer);
                
                pageElement.appendChild(audioContainer);
                
                // Initialize waveform visualization after page is added to DOM
                setTimeout(() => {
                    if (typeof WaveSurfer !== 'undefined') {
                        const wavesurfer = WaveSurfer.create({
                            container: `#waveform-${index}`,
                            waveColor: 'var(--primary-color-light)',
                            progressColor: 'var(--primary-color)',
                            cursorColor: 'var(--accent-color)',
                            barWidth: 2,
                            barRadius: 3,
                            responsive: true,
                            height: 80
                        });
                        
                        wavesurfer.load(page.audio);
                        
                        // Connect waveform to audio element
                        wavesurfer.on('ready', () => {
                            // Connect play button
                            playButton.addEventListener('click', () => {
                                wavesurfer.playPause();
                            });
                            
                            // Connect waveform clicks to audio element
                            wavesurfer.on('seek', () => {
                                audio.currentTime = wavesurfer.getCurrentTime();
                            });
                        });
                    }
                }, 100);
            } else if (fileType === 'video' && page.video) {
                const videoContainer = document.createElement('div');
                videoContainer.classList.add('page-video');
                
                // Create video player with enhanced controls
                const videoPlayer = document.createElement('div');
                videoPlayer.classList.add('video-player');
                
                const video = document.createElement('video');
                video.id = `video-${index}`;
                video.controls = true;
                video.src = page.video;
                video.poster = page.thumbnail || (page.frames && page.frames.length > 0 ? page.frames[0] : '');
                video.preload = "metadata";
                
                videoPlayer.appendChild(video);
                videoContainer.appendChild(videoPlayer);
                pageElement.appendChild(videoContainer);
                
                // Add custom video controls if desired
                const customControls = document.createElement('div');
                customControls.classList.add('custom-video-controls');
                
                // Add frame navigation if frames are available
                if (page.frames && page.frames.length > 0) {
                    const framesContainer = document.createElement('div');
                    framesContainer.classList.add('video-frames');
                    
                    // Add frame navigation buttons
                    const prevFrameBtn = document.createElement('button');
                    prevFrameBtn.classList.add('frame-nav-btn');
                    prevFrameBtn.innerHTML = '<i class="fas fa-step-backward"></i>';
                    
                    const nextFrameBtn = document.createElement('button');
                    nextFrameBtn.classList.add('frame-nav-btn');
                    nextFrameBtn.innerHTML = '<i class="fas fa-step-forward"></i>';
                    
                    let currentFrameIndex = 0;
                    
                    // Create frame thumbnails slider
                    const frameThumbnails = document.createElement('div');
                    frameThumbnails.classList.add('frame-thumbnails');
                    
                    page.frames.forEach((frame, frameIdx) => {
                        const frameImg = document.createElement('img');
                        frameImg.src = frame;
                        frameImg.alt = `Frame ${frameIdx + 1}`;
                        frameImg.className = 'video-frame-thumbnail';
                        
                        // Set data attribute for timestamp if available
                        if (page.frameTimestamps && page.frameTimestamps[frameIdx]) {
                            frameImg.dataset.timestamp = page.frameTimestamps[frameIdx];
                        }
                        
                        frameImg.addEventListener('click', () => {
                            // If timestamp available, seek to that position
                            if (frameImg.dataset.timestamp) {
                                video.currentTime = parseFloat(frameImg.dataset.timestamp);
                            }
                            
                            // Update current frame index
                            currentFrameIndex = frameIdx;
                            
                            // Show frame in modal
                            createImageModal(frame, `Frame ${frameIdx + 1}`);
                        });
                        
                        frameThumbnails.appendChild(frameImg);
                    });
                    
                    // Frame navigation logic
                    prevFrameBtn.addEventListener('click', () => {
                        if (currentFrameIndex > 0) {
                            currentFrameIndex--;
                            const frameImg = frameThumbnails.children[currentFrameIndex];
                            frameImg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            
                            // If timestamp available, seek to that position
                            if (frameImg.dataset.timestamp) {
                                video.currentTime = parseFloat(frameImg.dataset.timestamp);
                            }
                        }
                    });
                    
                    nextFrameBtn.addEventListener('click', () => {
                        if (currentFrameIndex < page.frames.length - 1) {
                            currentFrameIndex++;
                            const frameImg = frameThumbnails.children[currentFrameIndex];
                            frameImg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            
                            // If timestamp available, seek to that position
                            if (frameImg.dataset.timestamp) {
                                video.currentTime = parseFloat(frameImg.dataset.timestamp);
                            }
                        }
                    });
                    
                    framesContainer.appendChild(prevFrameBtn);
                    framesContainer.appendChild(frameThumbnails);
                    framesContainer.appendChild(nextFrameBtn);
                    
                    videoContainer.appendChild(framesContainer);
                }
                
                // Add caption display if captions available
                if (page.captions) {
                    const captionsContainer = document.createElement('div');
                    captionsContainer.classList.add('video-captions');
                    
                    // Create caption track element
                    const track = document.createElement('track');
                    track.kind = 'subtitles';
                    track.label = 'English';
                    track.srclang = 'en';
                    track.src = page.captions;
                    track.default = true;
                    
                    video.appendChild(track);
                    
                    // Add caption toggle button
                    const captionBtn = document.createElement('button');
                    captionBtn.classList.add('caption-btn');
                    captionBtn.innerHTML = '<i class="fas fa-closed-captioning"></i>';
                    captionBtn.title = "Toggle Captions";
                    
                    let captionsEnabled = true;
                    captionBtn.addEventListener('click', () => {
                        captionsEnabled = !captionsEnabled;
                        video.textTracks[0].mode = captionsEnabled ? 'showing' : 'hidden';
                        
                        if (captionsEnabled) {
                            captionBtn.classList.add('active');
                        } else {
                            captionBtn.classList.remove('active');
                        }
                    });
                    
                    customControls.appendChild(captionBtn);
                }
                
                // Add video speed control
                const videoSpeedControl = document.createElement('select');
                videoSpeedControl.classList.add('speed-control');
                
                const videoSpeeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
                videoSpeeds.forEach(speed => {
                    const option = document.createElement('option');
                    option.value = speed;
                    option.textContent = `${speed}x`;
                    if (speed === 1.0) option.selected = true;
                    videoSpeedControl.appendChild(option);
                });
                
                videoSpeedControl.addEventListener('change', () => {
                    video.playbackRate = parseFloat(videoSpeedControl.value);
                });
                
                customControls.appendChild(videoSpeedControl);
                videoContainer.appendChild(customControls);
            }
            
            // Add text content with improved styling
            if (page.text && page.text.trim()) {
                const textContainer = document.createElement('div');
                textContainer.classList.add('text-container');
                
                const textHeader = document.createElement('div');
                textHeader.classList.add('text-header');
                textHeader.innerHTML = '<i class="fas fa-align-left"></i> Extracted Text';
                textContainer.appendChild(textHeader);
                
                const textContent = document.createElement('div');
                textContent.classList.add('text-content');
                
                // Format the text with proper paragraphs
                const formattedText = page.text
                    .split('\n')
                    .filter(line => line.trim() !== '')
                    .map(line => `<p>${line}</p>`)
                    .join('');
                
                textContent.innerHTML = formattedText || '<p class="no-text">No text could be extracted.</p>';
                textContainer.appendChild(textContent);
                
                // Add text actions
                const actionsDiv = document.createElement('div');
                actionsDiv.classList.add('text-actions');
                
                const copyBtn = document.createElement('button');
                copyBtn.classList.add('copy-btn');
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Text';
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(page.text)
                        .then(() => {
                            const originalText = copyBtn.innerHTML;
                            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                            copyBtn.classList.add('copied');
                            setTimeout(() => {
                                copyBtn.innerHTML = originalText;
                                copyBtn.classList.remove('copied');
                            }, 2000);
                        })
                        .catch(err => {
                            console.error('Failed to copy text:', err);
                            showNotification('Failed to copy text. Please try again.', 'error');
                        });
                });
                actionsDiv.appendChild(copyBtn);
                
                // Add text-to-speech button if browser supports it
                if ('speechSynthesis' in window) {
                    const speakBtn = document.createElement('button');
                    speakBtn.classList.add('speak-btn');
                    speakBtn.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
                    
                    let speaking = false;
                    
                    speakBtn.addEventListener('click', () => {
                        if (speaking) {
                            window.speechSynthesis.cancel();
                            speakBtn.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
                            speaking = false;
                        } else {
                            const utterance = new SpeechSynthesisUtterance(page.text);
                            
                            // Set voice to first available
                            const voices = window.speechSynthesis.getVoices();
                            if (voices.length > 0) {
                                utterance.voice = voices[0];
                            }
                            
                            utterance.onend = () => {
                                speakBtn.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
                                speaking = false;
                            };
                            
                            window.speechSynthesis.speak(utterance);
                            speakBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Reading';
                            speaking = true;
                        }
                    });
                    
                    actionsDiv.appendChild(speakBtn);
                }
                
                textContainer.appendChild(actionsDiv);
                pageElement.appendChild(textContainer);
            }
            
            pagesContainer.appendChild(pageElement);
        });
    }
    
    // Helper function to format time in MM:SS
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    
    // Create modal for enlarged images
    function createImageModal(src, title) {
        // Check if modal already exists
        let modal = document.getElementById('image-modal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'image-modal';
            modal.classList.add('image-modal');
            document.body.appendChild(modal);
        }
        
        // Clear previous content
        modal.innerHTML = '';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.classList.add('modal-content');
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.classList.add('modal-close');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        });
        
        // Add title
        const modalTitle = document.createElement('div');
        modalTitle.classList.add('modal-title');
        modalTitle.textContent = title;
        
        // Add image
        const modalImage = document.createElement('img');
        modalImage.src = src;
        modalImage.alt = title;
        
        // Assemble modal
        modalContent.appendChild(closeBtn);
        modalContent.appendChild(modalTitle);
        modalContent.appendChild(modalImage);
        modal.appendChild(modalContent);
        
        // Show modal with animation
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            }
        });
    }
    
    // Show notification message
    function showNotification(message, type = 'info') {
        // Check if notifications container exists
        let notificationsContainer = document.getElementById('notifications-container');
        
        if (!notificationsContainer) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.id = 'notifications-container';
            document.body.appendChild(notificationsContainer);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.classList.add('notification', `notification-${type}`);
        
        // Add icon based on type
        let icon = '';
        switch (type) {
            case 'success':
                icon = '<i class="fas fa-check-circle"></i>';
                break;
            case 'error':
                icon = '<i class="fas fa-exclamation-circle"></i>';
                break;
            case 'warning':
                icon = '<i class="fas fa-exclamation-triangle"></i>';
                break;
            default:
                icon = '<i class="fas fa-info-circle"></i>';
        }
        
        notification.innerHTML = `
            ${icon}
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Add close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.classList.add('notification-closing');
            setTimeout(() => {
                notification.remove();
                
                // Remove container if empty
                if (notificationsContainer.children.length === 0) {
                    notificationsContainer.remove();
                }
            }, 300);
        });
        
        // Add to container
        notificationsContainer.appendChild(notification);
        
       // Auto close after 5 seconds
setTimeout(() => {
    if (notification.parentNode) {
        notification.classList.add('notification-closing');
        setTimeout(() => {
            notification.remove();
            
            // Remove container if empty
            if (notificationsContainer.children.length === 0) {
                notificationsContainer.remove();
            }
        }, 300);
    }
}, 5000);

// Return notification element for testing purposes
return notification;
}

// Back to menu button functionality
const backToMenuBtn = document.getElementById('back-to-menu');
if (backToMenuBtn) {
    backToMenuBtn.addEventListener('click', () => {
        results.classList.add('hidden');
        uploadForm.classList.remove('hidden');
        
        // Reset file input
        fileInput.value = '';
        fileName.textContent = 'Choose a file';
    });
}

// Reset app state function
window.resetApp = function() {
    results.classList.add('hidden');
    loading.classList.add('hidden');
    uploadForm.classList.remove('hidden');
    
    // Reset file input
    fileInput.value = '';
    fileName.textContent = 'Choose a file';
    
    showNotification('Ready for a new file!', 'info');
};

// Add drag and drop functionality to the upload area
const uploadArea = document.querySelector('.upload-area');
if (uploadArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        uploadArea.classList.add('highlight');
    }
    
    function unhighlight() {
        uploadArea.classList.remove('highlight');
    }
    
    uploadArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            // Trigger change event
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    }
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // ESC key to close modals
    if (e.key === 'Escape') {
        const modal = document.getElementById('image-modal');
        if (modal && modal.style.display !== 'none') {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
        
        // Also close file select popup if visible
        if (fileSelectPopup && !fileSelectPopup.classList.contains('hidden')) {
            fileSelectPopup.classList.add('hidden');
        }
    }
});

// Analytics tracking (if desired)
function trackEvent(category, action, label) {
    if (window.gtag) {
        gtag('event', action, {
            'event_category': category,
            'event_label': label
        });
    }
}

// Check for browser compatibility issues
function checkCompatibility() {
    const issues = [];
    
    // Check for FileReader API
    if (!window.FileReader) {
        issues.push('Your browser does not support the FileReader API, which is required for file uploads.');
    }
    
    // Check for Fetch API
    if (!window.fetch) {
        issues.push('Your browser does not support the Fetch API, which is required for communication with the server.');
    }
    
    // Check for modern CSS features
    const testElement = document.createElement('div');
    if (!('gridArea' in testElement.style)) {
        issues.push('Your browser may not fully support modern CSS features. The application may not display correctly.');
    }
    
    // Display compatibility issues if any
    if (issues.length > 0) {
        const compatWarning = document.createElement('div');
        compatWarning.classList.add('compat-warning');
        
        const warningTitle = document.createElement('h3');
        warningTitle.textContent = 'Browser Compatibility Issues';
        compatWarning.appendChild(warningTitle);
        
        const warningList = document.createElement('ul');
        issues.forEach(issue => {
            const listItem = document.createElement('li');
            listItem.textContent = issue;
            warningList.appendChild(listItem);
        });
        
        compatWarning.appendChild(warningList);
        compatWarning.appendChild(document.createTextNode('Please consider updating your browser for the best experience.'));
        
        document.body.insertBefore(compatWarning, document.body.firstChild);
    }
}

// Run compatibility check
checkCompatibility();

// Initialize tooltips
const tooltipElements = document.querySelectorAll('[data-tooltip]');
tooltipElements.forEach(element => {
    const tooltipText = element.getAttribute('data-tooltip');
    
    element.addEventListener('mouseenter', () => {
        const tooltip = document.createElement('div');
        tooltip.classList.add('tooltip');
        tooltip.textContent = tooltipText;
        
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        tooltip.style.top = `${rect.bottom + 10}px`;
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        
        setTimeout(() => {
            tooltip.classList.add('show');
        }, 10);
    });
    
    element.addEventListener('mouseleave', () => {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.classList.remove('show');
            setTimeout(() => {
                tooltip.remove();
            }, 200);
        }
    });
});

// Add a resize observer for responsive elements
if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            // Update UI elements that need responsive adjustments
            if (entry.target.classList.contains('page-video') || 
                entry.target.classList.contains('page-audio')) {
                // Adjust player controls based on width
                const player = entry.target.querySelector('.video-player, .audio-player');
                if (player) {
                    if (entry.contentRect.width < 400) {
                        player.classList.add('compact-controls');
                    } else {
                        player.classList.remove('compact-controls');
                    }
                }
            }
        }
    });
    
    // Observe elements that need responsive adjustments
    document.querySelectorAll('.page-video, .page-audio').forEach(el => {
        resizeObserver.observe(el);
    });
}

// Handle browser back button
window.addEventListener('popstate', function(event) {
    if (results.classList.contains('hidden')) {
        // Already on upload form, nothing to do
        return;
    }
    
    // Go back to upload form
    results.classList.add('hidden');
    uploadForm.classList.remove('hidden');
});

// Add history state when showing results
function addHistoryState() {
    const state = { page: 'results' };
    window.history.pushState(state, '', window.location.pathname);
}
});