from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd

from feature_extraction import extract_url_features

app=Flask(__name__)
CORS(app)

model=joblib.load("phishing_model.pkl")
feature_columns= joblib.load("feature_columns.pkl")

@app.route("/predict", methods=["POST"])
def predict():
    data=request.json
    url=data.get("url","")

    if not url:
        return jsonify({"error":"URL missing"}), 400

    features=extract_url_features(url)
    X = pd.DataFrame([features])[feature_columns]

    prob=model.predict_proba(X)[0][1]
    threshold= 0.25

    prediction= "Phishing" if prob>= threshold else "Legitmate"
    risk_score = int(prob*100)

    return jsonify({
        "prediction":"prediction",
        "risk_score":"risk_score",
        "confidence": round(float(prob), 3)
    })

if __name__=="__main__":
    app.run(port=5000, debug=True)














