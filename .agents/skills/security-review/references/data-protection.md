# Data Protection Reference

## Overview

Data protection encompasses safeguarding sensitive information throughout its lifecycle: collection, processing, storage, transmission, and disposal. Security failures at any stage can lead to data breaches.

## Sensitive Data Categories

### Personal Identifiable Information (PII)
- Full names, addresses, phone numbers
- Email addresses
- Social Security Numbers, national IDs
- Dates of birth
- Biometric data

### Financial Information
- Credit card numbers (PAN)
- Bank account numbers
- Financial transactions
- Payment credentials

### Authentication Credentials
- Passwords (plaintext or weakly hashed)
- API keys and tokens
- Session identifiers
- Private keys

### Health Information (PHI/HIPAA)
- Medical records
- Health conditions
- Treatment information
- Insurance data

---

## Sensitive Data Exposure Prevention

### 1. Data Classification

Classify all data by sensitivity level:

| Level | Examples | Handling |
|-------|----------|----------|
| **Public** | Marketing content | No restrictions |
| **Internal** | Employee directory | Access controls |
| **Confidential** | Customer data | Encryption + access controls |
| **Restricted** | Passwords, keys, PCI data | Strong encryption + audit logs |

### 2. Minimize Data Collection

```python
# VULNERABLE: Collecting unnecessary data
user_data = {
    'name': form.name,
    'email': form.email,
    'ssn': form.ssn,  # Why do you need this?
    'mother_maiden_name': form.mother_maiden_name,  # Security risk
    'password': form.password,  # Never store plaintext
}

# SAFE: Collect only what's needed
user_data = {
    'name': form.name,
    'email': form.email,
}
```

### 3. Encryption at Rest

```python
# Database-level encryption
# Configure in database settings (TDE for SQL Server, etc.)

# Application-level encryption for specific fields
from cryptography.fernet import Fernet

def encrypt_ssn(ssn):
    f = Fernet(get_encryption_key())
    return f.encrypt(ssn.encode())

def decrypt_ssn(encrypted_ssn):
    f = Fernet(get_encryption_key())
    return f.decrypt(encrypted_ssn).decode()
```

### 4. Encryption in Transit

```python
# VULNERABLE: HTTP endpoint
app.run(host='0.0.0.0', port=80)

# SAFE: HTTPS required
app.run(host='0.0.0.0', port=443, ssl_context='adhoc')

# BETTER: Proper TLS configuration
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain('cert.pem', 'key.pem')
ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
```

---

## Information Disclosure Prevention

### Error Messages

```python
# VULNERABLE: Detailed error messages
@app.errorhandler(Exception)
def handle_error(e):
    return {
        'error': str(e),
        'traceback': traceback.format_exc(),
        'sql_query': last_query,
        'server': socket.gethostname()
    }, 500

# SAFE: Generic error messages
@app.errorhandler(Exception)
def handle_error(e):
    # Log full details server-side
    app.logger.error(f"Error: {e}", exc_info=True)

    # Return generic message to client
    return {'error': 'An unexpected error occurred'}, 500
```

### Stack Traces

```python
# VULNERABLE: Debug mode in production
app.run(debug=True)

# SAFE: Debug off, custom error pages
app.run(debug=False)

@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('500.html'), 500
```

### API Response Filtering

```python
# VULNERABLE: Returning all fields
@app.route('/api/users/<id>')
def get_user(id):
    user = User.query.get(id)
    return jsonify(user.__dict__)  # Includes password_hash, internal_id, etc.

# SAFE: Explicit field selection
@app.route('/api/users/<id>')
def get_user(id):
    user = User.query.get(id)
    return jsonify({
        'id': user.public_id,
        'name': user.name,
        'email': user.email
    })
```

### Server Headers

```python
# VULNERABLE: Technology disclosure
# Response headers reveal:
# Server: Apache/2.4.41 (Ubuntu)
# X-Powered-By: PHP/7.4.3
# X-AspNet-Version: 4.0.30319

# SAFE: Remove or genericize headers
# In nginx:
# server_tokens off;

# In Express.js:
app.disable('x-powered-by');

# In Flask:
@app.after_request
def remove_headers(response):
    response.headers.pop('Server', None)
    return response
```

---

## Logging Security

### What NOT to Log

```python
# VULNERABLE: Logging sensitive data
logger.info(f"User login: {username}, password: {password}")
logger.info(f"API call with key: {api_key}")
logger.info(f"Credit card: {card_number}")
logger.debug(f"Session token: {session_id}")

# SAFE: Sanitized logging
logger.info(f"User login: {username}")
logger.info(f"API call with key: {api_key[:4]}****")
logger.info(f"Credit card: ****{card_number[-4:]}")
logger.debug(f"Session token: {hash_for_logging(session_id)}")
```

### Sensitive Data Patterns to Avoid in Logs

| Data Type | Pattern |
|-----------|---------|
| Passwords | `password`, `passwd`, `pwd`, `secret` |
| API Keys | `api_key`, `apikey`, `token`, `bearer` |
| Credit Cards | 16-digit numbers, `card_number` |
| SSN | `\d{3}-\d{2}-\d{4}`, `ssn`, `social` |
| Session IDs | `session`, `sess_id`, `jsessionid` |

### Log Injection Prevention

```python
# VULNERABLE: User input directly in logs
logger.info(f"Search query: {user_input}")
# Attack: user_input = "test\nINFO: Admin logged in"

# SAFE: Sanitize before logging
def sanitize_for_log(text):
    return text.replace('\n', '\\n').replace('\r', '\\r')

logger.info(f"Search query: {sanitize_for_log(user_input)}")
```

---

## Secure Data Disposal

### Memory Handling

```python
# Python strings are immutable - difficult to clear
# Use bytearray for sensitive data when possible

# BETTER: Clear sensitive data
import ctypes

def secure_zero(data):
    """Zero out sensitive data in memory."""
    if isinstance(data, bytearray):
        for i in range(len(data)):
            data[i] = 0
    elif isinstance(data, bytes):
        # Can't modify bytes, but can overwrite the reference
        pass

# In Java:
# char[] password = getPassword();
# try { ... }
# finally { Arrays.fill(password, '\0'); }
```

### File Deletion

```python
# VULNERABLE: Simple delete (data recoverable)
os.remove(sensitive_file)

# SAFER: Overwrite before delete
def secure_delete(filepath):
    with open(filepath, 'ba+') as f:
        length = f.tell()
        f.seek(0)
        f.write(os.urandom(length))  # Random overwrite
        f.flush()
        os.fsync(f.fileno())
    os.remove(filepath)
```

### Database Retention

```python
# Implement data retention policies
def cleanup_old_data():
    cutoff = datetime.now() - timedelta(days=RETENTION_DAYS)

    # Delete old records
    OldRecord.query.filter(OldRecord.created_at < cutoff).delete()

    # Or anonymize instead of delete
    User.query.filter(User.last_login < cutoff).update({
        'email': func.concat('deleted_', User.id, '@example.com'),
        'name': 'Deleted User',
        'phone': None
    })
```

---

## Cache Security

```python
# VULNERABLE: Caching sensitive data
@cache.cached(timeout=3600)
def get_user_with_ssn(user_id):
    return User.query.get(user_id)  # Includes SSN

# SAFE: Don't cache sensitive data
def get_user_with_ssn(user_id):
    return User.query.get(user_id)  # Not cached

# Or cache only non-sensitive parts
@cache.cached(timeout=3600)
def get_user_profile(user_id):
    user = User.query.get(user_id)
    return {
        'id': user.id,
        'name': user.name,
        # SSN excluded
    }
```

### Cache Headers

```python
# For sensitive pages
response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
response.headers['Pragma'] = 'no-cache'
response.headers['Expires'] = '0'
```

---

## Grep Patterns for Detection

```bash
# Sensitive data in logs
grep -rn "logger.*password\|log.*password\|print.*password" --include="*.py" --include="*.js"
grep -rn "logger.*token\|log.*api_key\|print.*secret" --include="*.py" --include="*.js"

# Debug mode
grep -rn "debug.*[Tt]rue\|DEBUG.*=.*1" --include="*.py" --include="*.js" --include="*.env"

# Stack traces in responses
grep -rn "traceback\|stack_trace\|exc_info" --include="*.py" | grep -i "return\|response\|json"

# Verbose errors
grep -rn "str(e)\|str(exception)" --include="*.py" | grep -i "return\|response"

# Technology disclosure
grep -rn "X-Powered-By\|Server:" --include="*.py" --include="*.js" --include="*.conf"

# Missing cache headers
grep -rn "Set-Cookie\|session" --include="*.py" | grep -v "Cache-Control"
```

---

## Testing Checklist

- [ ] Sensitive data encrypted at rest
- [ ] All transmissions over TLS 1.2+
- [ ] Error messages are generic (no stack traces, SQL errors, paths)
- [ ] Logging excludes sensitive data (passwords, tokens, PII)
- [ ] API responses filtered to necessary fields only
- [ ] Server headers don't reveal technology stack
- [ ] Sensitive pages have no-cache headers
- [ ] Data retention policies implemented
- [ ] Secure deletion procedures for sensitive files
- [ ] Debug mode disabled in production

---

## References

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- [CWE-200: Information Exposure](https://cwe.mitre.org/data/definitions/200.html)
- [CWE-532: Information Exposure Through Log Files](https://cwe.mitre.org/data/definitions/532.html)
- [CWE-209: Error Message Information Leak](https://cwe.mitre.org/data/definitions/209.html)
