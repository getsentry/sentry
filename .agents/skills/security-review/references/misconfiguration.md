# Security Misconfiguration Reference

## Overview

Security misconfiguration is one of the most common vulnerabilities. It occurs when security settings are not defined, implemented incorrectly, or left at insecure defaults. This includes missing security headers, overly permissive CORS, debug mode in production, and exposed sensitive endpoints.

---

## Security Headers

### Missing Headers

```python
# VULNERABLE: No security headers
@app.route('/')
def index():
    return render_template('index.html')

# SAFE: Security headers configured
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=()'
    return response
```

### Header Checklist

| Header | Purpose | Secure Value |
|--------|---------|--------------|
| `X-Content-Type-Options` | Prevent MIME sniffing | `nosniff` |
| `X-Frame-Options` | Prevent clickjacking | `DENY` or `SAMEORIGIN` |
| `Strict-Transport-Security` | Force HTTPS | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | Prevent XSS, injection | Restrictive policy |
| `Referrer-Policy` | Control referrer leakage | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Disable browser features | Disable unused features |

### Content Security Policy

```python
# VULNERABLE: Overly permissive CSP
"Content-Security-Policy: default-src *"
"Content-Security-Policy: script-src 'unsafe-inline' 'unsafe-eval'"

# SAFE: Restrictive CSP
"Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
```

---

## CORS Misconfiguration

### Dangerous Patterns

```python
# VULNERABLE: Allow all origins
CORS(app, origins='*')
Access-Control-Allow-Origin: *

# VULNERABLE: Reflect origin without validation
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin')
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

# VULNERABLE: Wildcard with credentials (browsers block, but shows misconfiguration)
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true

# VULNERABLE: Null origin allowed
Access-Control-Allow-Origin: null
```

### Safe CORS Configuration

```python
# SAFE: Explicit allowlist
ALLOWED_ORIGINS = {
    'https://app.example.com',
    'https://admin.example.com'
}

@app.after_request
def add_cors(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response
```

---

## Debug Mode in Production

### Dangerous Patterns

```python
# VULNERABLE: Debug mode enabled
# Flask
app.run(debug=True)
DEBUG = True

# Django
DEBUG = True  # in settings.py

# Express
app.set('env', 'development')

# Spring Boot
spring.devtools.restart.enabled=true
management.endpoints.web.exposure.include=*
```

### Detection

```python
# Check for debug indicators
if app.debug:
    # Exposes stack traces, allows code execution in some frameworks
    pass

# Check environment variables
if os.environ.get('DEBUG') == 'true':
    pass
if os.environ.get('FLASK_ENV') == 'development':
    pass
```

---

## Default Credentials

### Patterns to Flag

```python
# VULNERABLE: Default/weak credentials
username = 'admin'
password = 'admin'
password = 'password'
password = '123456'
password = 'changeme'
password = 'default'

# VULNERABLE: Well-known default credentials
# Database defaults
DB_PASSWORD = 'root'
DB_PASSWORD = 'postgres'
DB_PASSWORD = 'mysql'

# Admin panel defaults
ADMIN_PASSWORD = 'admin123'
SECRET_KEY = 'development-secret-key'
```

### Configuration Files to Check

```yaml
# Docker Compose
services:
  db:
    environment:
      MYSQL_ROOT_PASSWORD: root  # VULNERABLE
      POSTGRES_PASSWORD: postgres  # VULNERABLE

# Kubernetes Secrets (base64 encoded defaults)
apiVersion: v1
kind: Secret
data:
  password: YWRtaW4=  # 'admin' base64 encoded - VULNERABLE
```

---

## Exposed Endpoints

### Admin/Debug Endpoints

```python
# VULNERABLE: Exposed debug endpoints
@app.route('/debug')
@app.route('/admin')  # without authentication
@app.route('/metrics')  # without authentication
@app.route('/health')  # may expose sensitive info
@app.route('/env')
@app.route('/config')
@app.route('/phpinfo.php')
@app.route('/.git')
@app.route('/.env')

# Spring Boot Actuator endpoints
/actuator/env
/actuator/heapdump
/actuator/configprops
/actuator/mappings
```

### Protection

```python
# SAFE: Protect sensitive endpoints
@app.route('/admin')
@require_admin
def admin_panel():
    pass

@app.route('/metrics')
@require_internal_network
def metrics():
    pass

# Spring Boot: Restrict actuator
management.endpoints.web.exposure.include=health,info
management.endpoint.health.show-details=never
```

---

## TLS/SSL Misconfiguration

### Insecure Patterns

```python
# VULNERABLE: SSL verification disabled
requests.get(url, verify=False)
urllib3.disable_warnings()

# VULNERABLE: Weak TLS versions
ssl_context.minimum_version = ssl.TLSVersion.TLSv1  # Use TLS 1.2+

# VULNERABLE: Weak cipher suites
ssl_context.set_ciphers('ALL')
ssl_context.set_ciphers('DEFAULT')
```

### Secure Configuration

```python
# SAFE: Proper TLS configuration
import ssl

context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
context.minimum_version = ssl.TLSVersion.TLSv1_2
context.set_ciphers('ECDHE+AESGCM:DHE+AESGCM:ECDHE+CHACHA20')
context.verify_mode = ssl.CERT_REQUIRED
context.check_hostname = True
```

---

## Directory Listing

### Dangerous Patterns

```nginx
# VULNERABLE: Directory listing enabled
# Nginx
autoindex on;

# Apache
Options +Indexes

# Python
python -m http.server  # Lists directories by default
```

### Secure Configuration

```nginx
# SAFE: Directory listing disabled
# Nginx
autoindex off;

# Apache
Options -Indexes
```

---

## Verbose Error Messages

### Dangerous Patterns

```python
# VULNERABLE: Detailed errors in response
@app.errorhandler(Exception)
def handle_error(e):
    return jsonify({
        'error': str(e),
        'traceback': traceback.format_exc(),
        'query': last_executed_query,
        'config': app.config
    }), 500

# VULNERABLE: Stack traces exposed
app.config['PROPAGATE_EXCEPTIONS'] = True
```

### Secure Error Handling

```python
# SAFE: Generic error messages
@app.errorhandler(Exception)
def handle_error(e):
    app.logger.error(f"Error: {e}", exc_info=True)  # Log details server-side
    return jsonify({'error': 'An unexpected error occurred'}), 500
```

---

## Cookie Security

### Insecure Patterns

```python
# VULNERABLE: Insecure cookie settings
response.set_cookie('session', value)  # Missing flags

# VULNERABLE: Explicit insecure flags
response.set_cookie('session', value, secure=False, httponly=False, samesite='None')
```

### Secure Cookie Configuration

```python
# SAFE: Secure cookie settings
response.set_cookie(
    'session',
    value,
    secure=True,       # HTTPS only
    httponly=True,     # No JavaScript access
    samesite='Lax',    # CSRF protection
    max_age=3600,      # Reasonable expiration
    path='/',
    domain='.example.com'
)

# Flask session configuration
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
```

---

## Permissive File Permissions

### Dangerous Patterns

```python
# VULNERABLE: World-readable sensitive files
os.chmod(config_file, 0o777)
os.chmod(private_key, 0o644)

# VULNERABLE: Overly permissive umask
os.umask(0o000)
```

### Secure Permissions

```python
# SAFE: Restrictive permissions
os.chmod(config_file, 0o600)  # Owner read/write only
os.chmod(private_key, 0o400)  # Owner read only
os.chmod(script, 0o700)       # Owner execute only
```

---

## HTTP Methods

### Dangerous Patterns

```python
# VULNERABLE: All methods allowed
@app.route('/api/data', methods=['GET', 'POST', 'PUT', 'DELETE', 'TRACE', 'OPTIONS'])

# VULNERABLE: TRACE method enabled (XST attacks)
# VULNERABLE: Unnecessary methods on sensitive endpoints
```

### Secure Configuration

```python
# SAFE: Explicit method restrictions
@app.route('/api/data', methods=['GET'])
def get_data():
    pass

@app.route('/api/data', methods=['POST'])
@require_auth
def create_data():
    pass
```

---

## Grep Patterns for Detection

```bash
# Debug mode
grep -rn "debug.*=.*[Tt]rue\|DEBUG.*=.*[Tt]rue" --include="*.py" --include="*.js" --include="*.json"

# CORS wildcards
grep -rn "Access-Control-Allow-Origin.*\*\|origins.*\*\|origin.*\*" --include="*.py" --include="*.js"

# SSL verification disabled
grep -rn "verify.*=.*[Ff]alse\|rejectUnauthorized.*false\|NODE_TLS_REJECT_UNAUTHORIZED" --include="*.py" --include="*.js"

# Default credentials
grep -rn "password.*=.*['\"]admin\|password.*=.*['\"]root\|password.*=.*['\"]123456" --include="*.py" --include="*.yaml" --include="*.yml"

# Missing security headers (check for absence)
grep -rn "after_request\|middleware" --include="*.py" | grep -v "X-Content-Type-Options\|X-Frame-Options"

# Exposed endpoints
grep -rn "@app.route.*debug\|@app.route.*admin\|@app.route.*config\|/actuator" --include="*.py" --include="*.java"
```

---

## References

- [OWASP Security Misconfiguration](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)
- [OWASP HTTP Security Headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
- [CWE-16: Configuration](https://cwe.mitre.org/data/definitions/16.html)
