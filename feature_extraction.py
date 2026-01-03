def extract_url_features(url):
    features={}

    try:
        parsed=urlparse(url)
    except Exception as e:
        parsed=None

    features['url_length']=len(url)

    domain=parsed.netloc if parsed and parsed.netloc else url
    features['domain_length']=len(domain)

    path=parsed.path if parsed else ""
    features['path_length']=len(path)

    features['num_dots']=url.count('.')

    features['num_hyphens']=url.count('-')

    features['num_slashes']=url.count('/')

    features['num_subdomains'] = max(0, domain.count('.') - 1)
    features['multiple_hyphens'] = 1 if domain.count('-') > 1 else 0

    features['has_ipv4']=1 if re.match(r'^\d+\.\d+\.\d+\.\d+$',domain) else 0

    features['has_ipv6']=1 if re.match(r'^\[([0-9a-fA-F:]+)\]$',domain) else 0

    suspicious_tlds = ['tk','ml','ga','cf','gq']
    features['suspicious_tld'] = 1 if domain.split('.')[-1] in suspicious_tlds else 0

    phishing_keywords = ['login','secure','account','verify','update','bank','confirm','signin','webscr','paypal','amazon','apple']
    features['phishing_keyword'] = 1 if any(k in url.lower() for k in phishing_keywords) else 0

    brands = ['paypal','google','amazon','facebook','apple','microsoft']
    features['brand_in_path'] = 1 if any(b in path.lower() for b in brands) else 0

    shorteners = ['bit.ly','tinyurl','goo.gl','t.co','ow.ly']
    features['is_shortened'] = 1 if any(s in url.lower() for s in shorteners) else 0

    if parsed and parsed.scheme:
        features['is_https'] = 1 if parsed.scheme.lower() == 'https' else 0
    else:
        features['is_https'] = 0

    features['num_digits']=sum(c.isdigit() for c in url)

    features['has_at_symbol']=1 if '@' in url else 0
    features['has_encoded_chars'] = 1 if '%' in url else 0

    return features 
