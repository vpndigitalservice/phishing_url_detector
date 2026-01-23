from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import re
from urllib.parse import urlparse
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app, origins=["http://127.0.0.1:*", "chrome-extension://*"])

# Load model
try:
    model = joblib.load("phishing_model.pkl")
    feature_columns = joblib.load("feature_columns.pkl")
    print("✅ Model loaded successfully!")
    print(f"📊 Model type: {type(model).__name__}")
    print(f"🔡 Feature columns: {len(feature_columns)}")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None
    feature_columns = []

def extract_url_features(url):
    """Extract features from URL for prediction"""
    features = {}
    
    try:
        parsed = urlparse(url)
    except:
        parsed = None
    
    # Basic features
    features['url_length'] = len(url)
    
    domain = parsed.netloc if parsed and parsed.netloc else url
    features['domain_length'] = len(domain)
    
    path = parsed.path if parsed else ""
    features['path_length'] = len(path)
    
    # Character counts
    features['num_dots'] = url.count('.')
    features['num_hyphens'] = url.count('-')
    features['num_slashes'] = url.count('/')
    features['num_digits'] = sum(c.isdigit() for c in url)
    
    # Domain features
    features['num_subdomains'] = max(0, domain.count('.') - 1)
    features['multiple_hyphens'] = 1 if domain.count('-') > 1 else 0
    
    # IP detection
    ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
    features['has_ipv4'] = 1 if re.match(ip_pattern, domain) else 0
    features['has_ipv6'] = 1 if '[' in domain and ']' in domain else 0
    
    # TLD check
    suspicious_tlds = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'club', 'info', 'bid', 'win']
    tld = domain.split('.')[-1] if '.' in domain else ''
    features['suspicious_tld'] = 1 if tld in suspicious_tlds else 0
    
    # Keywords
    phishing_keywords = ['login', 'secure', 'account', 'verify', 'update', 'bank', 
                        'confirm', 'signin', 'webscr', 'paypal', 'amazon', 'apple']
    features['phishing_keyword'] = 1 if any(k in url.lower() for k in phishing_keywords) else 0
    
    brands = ['paypal', 'google', 'amazon', 'facebook', 'apple', 'microsoft']
    features['brand_in_path'] = 1 if any(b in path.lower() for b in brands) else 0
    
    # URL shortening
    shorteners = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'ow.ly']
    features['is_shortened'] = 1 if any(s in url.lower() for s in shorteners) else 0
    
    # Protocol
    features['is_https'] = 1 if parsed and parsed.scheme == 'https' else 0
    
    # Special chars
    features['has_at_symbol'] = 1 if '@' in url else 0
    features['has_encoded_chars'] = 1 if '%' in url else 0
    
    # Ensure all expected features
    expected_features = [
        'url_length', 'domain_length', 'path_length', 'num_dots', 'num_hyphens',
        'num_slashes', 'num_subdomains', 'multiple_hyphens', 'has_ipv4', 'has_ipv6',
        'suspicious_tld', 'phishing_keyword', 'brand_in_path', 'is_shortened',
        'is_https', 'num_digits', 'has_at_symbol', 'has_encoded_chars'
    ]
    
    for feat in expected_features:
        if feat not in features:
            features[feat] = 0
    
    return features

@app.route("/predict", methods=["POST"])
def predict():
    """ML prediction endpoint"""
    try:
        if not model:
            return jsonify({
                "error": "Model not loaded",
                "prediction": "Error",
                "risk_score": 50
            }), 500
        
        data = request.json
        url = data.get("url", "").strip()
        
        if not url:
            return jsonify({"error": "No URL provided"}), 400
        
        print(f"🔍 Predicting for URL: {url}")
        
        # Extract features
        features = extract_url_features(url)
        
        # Create DataFrame
        X = pd.DataFrame([features])
        
        # Ensure correct feature order
        missing_cols = set(feature_columns) - set(X.columns)
        extra_cols = set(X.columns) - set(feature_columns)
        
        for col in missing_cols:
            X[col] = 0
        
        X = X[feature_columns]
        
        # Predict
        prob = model.predict_proba(X)[0][1]
        risk_score = int(prob * 100)
        
        # Determine result
        threshold = 0.25
        prediction = "Phishing" if prob >= threshold else "Legitimate"
        
        print(f"📊 Result: {prediction} (Score: {risk_score}, Prob: {prob:.3f})")
        
        return jsonify({
            "prediction": prediction,
            "risk_score": risk_score,
            "confidence": round(float(prob), 3),
            "features": features
        })
        
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        return jsonify({
            "error": str(e),
            "prediction": "Error",
            "risk_score": 50,
            "confidence": 0.5
        }), 500

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "running" if model else "no_model",
        "model_loaded": model is not None,
        "features_count": len(feature_columns) if feature_columns else 0
    })

@app.route("/test", methods=["GET"])
def test():
    """Test endpoint"""
    return jsonify({
        "message": "Phish Guard API is running!",
        "endpoints": {
            "GET /health": "Check server status",
            "POST /predict": "Predict URL risk (send JSON with 'url' field)"
        }
    })

if __name__ == "__main__":
    print("🚀 Starting Phish Guard Backend...")
    print("🌐 Server will run at: http://127.0.0.1:5000")
    print("📝 Available endpoints:")
    print("   GET  /health  - Health check")
    print("   GET  /test    - Test endpoint")
    print("   POST /predict - ML prediction")
    app.run(host="127.0.0.1", port=5000, debug=True)