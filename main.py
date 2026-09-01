import torch
import rasterio
import numpy as np
import pandas as pd
from datetime import timedelta
import segmentation_models_pytorch as smp

# ---------------------------------------------------------
# Step 1: Neural Network Setup
# ---------------------------------------------------------
def load_unet_model(weights_path):
    """Loads the pre-built U-Net architecture and saved weights."""
    print("Loading U-Net model...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    model = smp.Unet(
        encoder_name="resnet34", 
        encoder_weights=None, 
        in_channels=1, 
        classes=1
    )
    
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()
    return model, device

# ---------------------------------------------------------
# Step 2: Satellite Image Processing
# ---------------------------------------------------------
def get_spill_centroid_unet(sar_geotiff_path, model, device):
    """Passes the satellite image through U-Net and extracts the GPS center."""
    print(f"Reading satellite data from {sar_geotiff_path}...")
    
    with rasterio.open(sar_geotiff_path) as src:
        image = src.read(1).astype(np.float32)
        image = (image - np.min(image)) / (np.max(image) - np.min(image) + 1e-8)
        image = image[0:512, 0:512]
        
        input_tensor = torch.tensor(image).unsqueeze(0).unsqueeze(0).to(device)
        
        print("Running neural network inference...")
        with torch.no_grad():
            prediction = model(input_tensor)
            mask = (prediction.squeeze().cpu().numpy() > 0.5).astype(np.uint8)

        spill_pixels = np.where(mask == 1)
        if len(spill_pixels[0]) == 0:
            return None, None
            
        row_centroid = int(np.mean(spill_pixels[0]))
        col_centroid = int(np.mean(spill_pixels[1]))
        
        lon, lat = src.xy(row_centroid, col_centroid)
        return lat, lon

# ---------------------------------------------------------
# Step 3: AIS Tanker Tracking
# ---------------------------------------------------------
def haversine_distance(lat1, lon1, lat2, lon2):
    """Math formula to calculate distance between two GPS points in nautical miles."""
    R = 3440.065 # Radius of earth in nautical miles
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    delta_phi = np.radians(lat2 - lat1)
    delta_lambda = np.radians(lon2 - lon1)
    a = np.sin(delta_phi/2.0)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda/2.0)**2
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))

def find_culprit_tankers(ais_csv_path, spill_lat, spill_lon, spill_time_str, time_window_hours=12):
    """Searches the AIS database and returns sorted suspects."""
    print("Cross-referencing satellite data with AIS logs...")
    
    df = pd.read_csv(ais_csv_path, low_memory=False)
    df.columns = df.columns.str.strip()
    
    col_map = {}
    for col in df.columns:
        c_lower = col.lower()
        if 'time' in c_lower or 'date' in c_lower:
            col_map[col] = 'BaseDateTime'
        elif c_lower in ['latitude', 'lat']:
            col_map[col] = 'LAT'
        elif c_lower in ['longitude', 'lon', 'long']:
            col_map[col] = 'LON'
        elif c_lower in ['speed', 'sog']:
            col_map[col] = 'SOG'
        elif 'type' in c_lower:
            col_map[col] = 'VesselType'
        elif 'mmsi' in c_lower:
            col_map[col] = 'MMSI'
        elif 'vesselname' in c_lower or 'name' in c_lower:
            col_map[col] = 'VesselName'
            
    df = df.rename(columns=col_map)
    
    if 'VesselName' not in df.columns:
        df['VesselName'] = 'Unknown Vessel'

    df['BaseDateTime'] = pd.to_datetime(df['BaseDateTime'], errors='coerce')
    df = df.dropna(subset=['BaseDateTime', 'LAT', 'LON'])
    
    spill_time = pd.to_datetime(spill_time_str)
    start_time = spill_time - timedelta(hours=time_window_hours)
    df = df[(df['BaseDateTime'] >= start_time) & (df['BaseDateTime'] <= spill_time)]
    
    if df.empty:
        print(f"[-] No vessels found between {start_time} and {spill_time}.")
        return None

    if 'VesselType' in df.columns:
        is_tanker = pd.to_numeric(df['VesselType'], errors='coerce').between(80, 89) | (df['VesselType'].astype(str).str.contains('Tanker|tanker', na=False))
        tanker_df = df[is_tanker]
        if not tanker_df.empty:
            df = tanker_df

    # Calculate distance and flag slow speeds
    df['Distance_NM'] = df.apply(lambda row: haversine_distance(spill_lat, spill_lon, row['LAT'], row['LON']), axis=1)
    df['Anomalous_Speed'] = df['SOG'] < 4.0
    
    # SORTING: Primary sort by Closest Distance, Secondary sort by Speed
    candidates = df.sort_values(by=['Distance_NM', 'SOG'], ascending=[True, True])
    
    return candidates[['VesselName', 'MMSI', 'BaseDateTime', 'LAT', 'LON', 'SOG', 'Distance_NM']].head(5)

# ---------------------------------------------------------
# Execution
# ---------------------------------------------------------
if __name__ == "__main__":
    sar_image = "data/sentinel1_image.tif"
    ais_csv_path = "data/ais_logs.csv"
    model_weights = "unet_oil_spill.pth"
    satellite_pass_time = "2021-08-15T10:30:00" 

    model, device = load_unet_model(model_weights)
    lat, lon = get_spill_centroid_unet(sar_image, model, device)
    
    if lat and lon:
        print(f"\n[+] Spill detected at Latitude: {lat:.4f}, Longitude: {lon:.4f}")
        
        candidates = find_culprit_tankers(ais_csv_path, lat, lon, satellite_pass_time)
        
        if candidates is not None and not candidates.empty:
            print("\n*** TOP SUSPECT TANKERS (SORTED BY DISTANCE) ***")
            for index, row in candidates.iterrows():
                print(f"- {row['VesselName']} (MMSI: {row['MMSI']}) | Distance: {row['Distance_NM']:.1f} NM | Speed: {row['SOG']} knots")
    else:
        print("\n[-] U-Net did not detect an oil spill in this image segment.")