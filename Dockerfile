# Use Python 3.9 as the base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies for Tesseract OCR, pdf2image, speech recognition, and video processing
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    libportaudio2 \
    libpulse-dev \
    libasound2-dev \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file if you have one
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make port 5000 available
EXPOSE 5000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV FLASK_DEBUG=1
ENV HOST=0.0.0.0

# Create a wrapper script to run Flask with the correct host
COPY run.py .

# Run the application with host binding explicitly set to 0.0.0.0
CMD ["python", "run.py"]