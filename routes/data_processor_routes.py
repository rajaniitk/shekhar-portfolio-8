from flask import Blueprint, request, jsonify, session, redirect, url_for
import os
import pandas as pd
import numpy as np
from werkzeug.utils import secure_filename
from services.data_processor import DataProcessor
from app import db
from models import Dataset
import logging

data_processor_bp = Blueprint('data_processor', __name__, url_prefix='/api/data')

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'json', 'parquet'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@data_processor_bp.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Supported: CSV, XLSX, JSON, Parquet'}), 400
        
        # Create uploads directory if it doesn't exist
        upload_folder = 'uploads'
        os.makedirs(upload_folder, exist_ok=True)
        
        # Save file
        filename = secure_filename(file.filename)
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)
        
        # Process file
        processor = DataProcessor()
        result = processor.process_file(file_path, filename)
        
        if result['success']:
            # Save dataset info to database
            dataset = Dataset(
                filename=filename,
                original_filename=file.filename,
                file_path=file_path,
                file_type=result['file_type'],
                file_size=os.path.getsize(file_path),
                num_rows=result['num_rows'],
                num_columns=result['num_columns'],
                column_names=result['column_names'],
                column_types=result['column_types'],
                missing_values=result['missing_values']
            )
            db.session.add(dataset)
            db.session.commit()
            
            # Store dataset ID in session
            session['dataset_id'] = dataset.id
            
            return jsonify({
                'success': True,
                'dataset_id': dataset.id,
                'preview': result['preview'],
                'info': result['info']
            })
        else:
            return jsonify({'error': result['error']}), 400
            
    except Exception as e:
        logging.error(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@data_processor_bp.route('/preview/<int:dataset_id>')
def get_preview(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        processor = DataProcessor()
        preview = processor.get_preview(dataset.file_path)
        return jsonify(preview)
    except Exception as e:
        logging.error(f"Preview error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@data_processor_bp.route('/info/<int:dataset_id>')
def get_info(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        processor = DataProcessor()
        info = processor.get_dataset_info(dataset.file_path)
        return jsonify(info)
    except Exception as e:
        logging.error(f"Info error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@data_processor_bp.route('/clean', methods=['POST'])
def clean_data():
    try:
        dataset_id = request.json.get('dataset_id')
        cleaning_options = request.json.get('options', {})
        
        dataset = Dataset.query.get_or_404(dataset_id)
        processor = DataProcessor()
        
        result = processor.clean_data(dataset.file_path, cleaning_options)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Data cleaned successfully',
                'stats': result['stats']
            })
        else:
            return jsonify({'error': result['error']}), 400
            
    except Exception as e:
        logging.error(f"Clean data error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@data_processor_bp.route('/columns/<int:dataset_id>')
def get_columns(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        processor = DataProcessor()
        columns = processor.get_columns_info(dataset.file_path)
        return jsonify(columns)
    except Exception as e:
        logging.error(f"Columns error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@data_processor_bp.route('/sample/<int:dataset_id>')
def get_sample(dataset_id):
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        processor = DataProcessor()
        sample = processor.get_sample_data(dataset.file_path)
        return jsonify(sample)
    except Exception as e:
        logging.error(f"Sample error: {str(e)}")
        return jsonify({'error': str(e)}), 500
