from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import pandas as pd

# 1. UPDATED IMPORTS: Match the new main.py exactly
from main import (
    load_unet_model,
    get_spill_centroid_unet,
    find_culprit_tankers
)

app = Flask(__name__)
CORS(app)

os.makedirs('uploads', exist_ok=True)

WEIGHTS_PATH = "unet_oil_spill.pth"
AIS_CSV_PATH = "data/ais_logs.csv" # Ensure this path points to your CSV

# Load the model once when the server starts
model, device = load_unet_model(WEIGHTS_PATH)

@app.route('/api/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
        
    file = request.files['image']
    pass_time = request.form.get('pass_time', '2026-03-14T18:30:00')
    
    file_path = os.path.join('uploads', file.filename)
    file.save(file_path)
    
    try:
        # 2. RUN U-NET ON THE IMAGE AND GET SPILL CENTROID
        lat, lon = get_spill_centroid_unet(file_path, model, device)

        if lat is None or lon is None:
            return jsonify({"error": "No spill detected in SAR image"}), 404

        # 3. RUN AIS LOGIC TO FIND CULPRIT TANKERS
        candidates = find_culprit_tankers(AIS_CSV_PATH, lat, lon, pass_time)

        # Handle case where no ships are found
        if candidates is None or (hasattr(candidates, 'empty') and candidates.empty):
            return jsonify({"spill": {"lat": lat, "lon": lon}, "suspects": []})

        # 6. FORMAT FOR REACT
        suspects_list = []
        for _, row in candidates.iterrows():
            suspects_list.append({
                "mmsi": str(row.get('MMSI', 'N/A')),
                "name": str(row.get('MMSI', 'UNKNOWN_VESSEL')), # Fallback if name is missing
                "speed": round(float(row.get('SOG', 0.0)), 1),
                "dist": round(float(row.get('Distance_NM', 0.0)), 1),
                "time": str(row.get('BaseDateTime', ''))
            })

        return jsonify({
            "spill": {"lat": lat, "lon": lon},
            "suspects": suspects_list
        })
        
    except Exception as e:
        # Catch coordinate errors (like missing CRS) and send to frontend
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Flask server on port 5000...")
    app.run(port=5000, debug=True)