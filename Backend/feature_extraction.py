from urllib.parse import urlparse
import re

def extract_url_features(url):
    features = {}
    
    try:
        parsed = urlparse(url)
    except Exception as e:
        parsed = None
    
    # Basic URL features
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
    
    # IP addresses
    ipv4_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
    features['has_ipv4'] = 1 if re.match(ipv4_pattern, domain) else 0
    features['has_ipv6'] = 1 if '[' in domain and ']' in domain else 0
    
    # Suspicious TLDs
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
    shorteners = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly']
    features['is_shortened'] = 1 if any(s in url.lower() for s in shorteners) else 0
    
    # Protocol
    if parsed and parsed.scheme:
        features['is_https'] = 1 if parsed.scheme.lower() == 'https' else 0
    else:
        features['is_https'] = 0
    
    # Special characters
    features['has_at_symbol'] = 1 if '@' in url else 0
    features['has_encoded_chars'] = 1 if '%' in url else 0
    
    # Ensure all features from training are present
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