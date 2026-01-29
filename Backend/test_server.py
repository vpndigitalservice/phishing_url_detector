import requests
import json

def test_server():
    print("Testing Phish Guard Backend...")
    
    # Test 1: Health check
    try:
        resp = requests.get("http://127.0.0.1:5000/health", timeout=5)
        print(f"✅ Health check: {resp.json()}")
    except:
        print("❌ Server not running! Start with: python app.py")
        return
    
    # Test 2: Test endpoint
    try:
        resp = requests.get("http://127.0.0.1:5000/test", timeout=5)
        print(f"✅ Test endpoint: {resp.json()}")
    except Exception as e:
        print(f"❌ Test endpoint failed: {e}")
    
    # Test 3: Predictions
    test_urls = [
        "https://www.google.com",
        "http://secure-login-verify-facebook.com",
        "http://192.168.1.1/login",
        "https://phishing-site.xyz"
    ]
    
    for url in test_urls:
        try:
            resp = requests.post(
                "http://127.0.0.1:5000/predict",
                json={"url": url},
                timeout=10
            )
            result = resp.json()
            print(f"\n🔗 URL: {url}")
            print(f"   Prediction: {result.get('prediction', 'Error')}")
            print(f"   Risk Score: {result.get('risk_score', 'N/A')}")
            print(f"   Confidence: {result.get('confidence', 'N/A')}")
        except Exception as e:
            print(f"\n❌ Failed for {url}: {e}")

if __name__ == "__main__":
    test_server()