# Cross-Site Request Forgery (CSRF) Prevention Reference

## Overview

CSRF attacks trick authenticated users into performing unintended actions by exploiting the browser's automatic credential transmission. The attack works because browsers automatically include cookies with requests to a domain, regardless of the request's origin.

## Attack Scenario

```html
<!-- Attacker's page -->
<img src="https://bank.com/transfer?to=attacker&amount=10000">

<!-- Or form submission -->
<form action="https://bank.com/transfer" method="POST" id="evil">
    <input name="to" value="attacker">
    <input name="amount" value="10000">
</form>
<script>document.getElementById('evil').submit();</script>
```

When a logged-in user visits the attacker's page, their browser makes the request with their session cookie.

---

## Primary Defenses

### 1. Synchronizer Token Pattern

Generate and validate a unique token per session.

```python
import secrets

# Generate token on session creation
def create_csrf_token(session_id):
    token = secrets.token_urlsafe(32)
    store_csrf_token(session_id, token)
    return token

# Include in forms
def render_form():
    token = get_csrf_token(session.id)
    return f'''
    <form method="POST">
        <input type="hidden" name="csrf_token" value="{token}">
        <!-- form fields -->
    </form>
    '''

# Validate on submission
def validate_csrf():
    submitted_token = request.form.get('csrf_token')
    stored_token = get_csrf_token(session.id)

    if not submitted_token or not secrets.compare_digest(submitted_token, stored_token):
        raise CSRFValidationError()
```

### 2. Double Submit Cookie Pattern (Stateless)

Use a cryptographically signed token that doesn't require server-side storage.

```python
import hmac
import hashlib
import time

SECRET_KEY = os.environ['CSRF_SECRET']

def generate_csrf_token(session_id):
    """Generate signed token tied to session."""
    timestamp = int(time.time())
    message = f"{session_id}:{timestamp}"
    signature = hmac.new(
        SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{timestamp}:{signature}"

def validate_csrf_token(token, session_id):
    """Validate token matches session and isn't expired."""
    try:
        timestamp, signature = token.split(':')
        timestamp = int(timestamp)

        # Check expiry (1 hour)
        if time.time() - timestamp > 3600:
            return False

        # Verify signature
        message = f"{session_id}:{timestamp}"
        expected = hmac.new(
            SECRET_KEY.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()

        return secrets.compare_digest(signature, expected)
    except:
        return False
```

### 3. SameSite Cookie Attribute

```python
# Modern browsers respect SameSite attribute
response.set_cookie(
    'session_id',
    value=session_id,
    samesite='Lax',   # Or 'Strict' for maximum protection
    secure=True,
    httponly=True
)
```

**SameSite Values:**

| Value | Behavior |
|-------|----------|
| **Strict** | Never sent cross-site |
| **Lax** | Sent only with safe methods (GET) on top-level navigation |
| **None** | Always sent (requires Secure) |

### 4. Custom Request Headers

For AJAX/API requests, require a custom header that can't be set cross-origin without CORS.

```javascript
// Client
fetch('/api/transfer', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFToken()  // Or any custom header
    },
    body: JSON.stringify(data)
});
```

```python
# Server
@app.before_request
def verify_csrf_header():
    if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        token = request.headers.get('X-CSRF-Token')
        if not validate_csrf_token(token):
            return jsonify({'error': 'CSRF validation failed'}), 403
```

---

## Framework Implementations

### Django

```python
# Enabled by default via middleware
MIDDLEWARE = [
    'django.middleware.csrf.CsrfViewMiddleware',
    ...
]

# In templates
<form method="POST">
    {% csrf_token %}
    ...
</form>

# For AJAX
<script>
const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;
fetch('/api/endpoint', {
    method: 'POST',
    headers: {'X-CSRFToken': csrftoken},
    ...
});
</script>
```

### Flask

```python
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect(app)

# In templates
<form method="POST">
    <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
    ...
</form>

# Exempt specific routes if needed (be careful!)
@csrf.exempt
@app.route('/webhook', methods=['POST'])
def webhook():
    pass
```

### Express.js

```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

app.use(csrfProtection);

app.get('/form', (req, res) => {
    res.render('form', { csrfToken: req.csrfToken() });
});

// In template
<form method="POST">
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">
    ...
</form>
```

---

## Origin and Referer Validation

As a supplementary defense:

```python
def verify_origin():
    """Verify request origin matches expected domain."""
    origin = request.headers.get('Origin')
    referer = request.headers.get('Referer')

    # Prefer Origin header
    if origin:
        if not is_trusted_origin(origin):
            return False
        return True

    # Fall back to Referer
    if referer:
        parsed = urlparse(referer)
        if not is_trusted_origin(f"{parsed.scheme}://{parsed.netloc}"):
            return False
        return True

    # No origin info - could be same-origin or direct request
    # Decision depends on security requirements
    return True  # Or False for strict validation

def is_trusted_origin(origin):
    TRUSTED = {'https://example.com', 'https://admin.example.com'}
    return origin in TRUSTED
```

---

## Fetch Metadata Headers

Modern browsers send additional headers that indicate request context:

```python
def check_fetch_metadata():
    """Use Fetch Metadata headers for CSRF protection."""
    sec_fetch_site = request.headers.get('Sec-Fetch-Site')
    sec_fetch_mode = request.headers.get('Sec-Fetch-Mode')

    # Allow same-origin requests
    if sec_fetch_site == 'same-origin':
        return True

    # Allow navigation requests (clicking links)
    if sec_fetch_site == 'none' and sec_fetch_mode == 'navigate':
        return True

    # Block cross-origin state-changing requests
    if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        if sec_fetch_site in ('cross-site', 'same-site'):
            return False

    return True
```

---

## Client-Side CSRF

Modern variant where JavaScript code uses attacker-controlled input:

```javascript
// VULNERABLE: URL fragment used in request
const param = window.location.hash.substring(1);
fetch(`/api/action?${param}`, { method: 'POST' });

// Attack: https://example.com#action=delete&target=all

// SAFE: Validate before use
const allowedActions = ['view', 'refresh'];
const param = window.location.hash.substring(1);
const parsed = new URLSearchParams(param);
if (allowedActions.includes(parsed.get('action'))) {
    fetch(`/api/action?${param}`, { method: 'POST' });
}
```

---

## Common Mistakes

### 1. GET Requests for State Changes

```python
# VULNERABLE: State change via GET
@app.route('/delete/<id>')
def delete_item(id):
    Item.delete(id)  # Attacker: <img src="/delete/123">

# SAFE: Use POST for state changes
@app.route('/delete/<id>', methods=['POST'])
@csrf_required
def delete_item(id):
    Item.delete(id)
```

### 2. CORS Misconfiguration

```python
# VULNERABLE: Allows any origin with credentials
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin')
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

# SAFE: Explicit allowlist
ALLOWED_ORIGINS = {'https://trusted.com'}

@app.after_request
def add_cors(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response
```

### 3. Token in URL

```html
<!-- VULNERABLE: Token exposed in URL (logged, cached, referer) -->
<a href="/action?csrf_token=abc123">Do Action</a>

<!-- SAFE: Token in form -->
<form method="POST" action="/action">
    <input type="hidden" name="csrf_token" value="abc123">
    <button type="submit">Do Action</button>
</form>
```

---

## Grep Patterns for Detection

```bash
# Missing CSRF protection
grep -rn "@app\.route.*POST\|@router\.post" --include="*.py" | grep -v "csrf"

# State-changing GET requests
grep -rn "\.delete\|\.update\|\.create" --include="*.py" | grep "GET"

# CORS wildcards
grep -rn "Access-Control-Allow-Origin.*\*" --include="*.py"

# Framework CSRF disabled
grep -rn "csrf_exempt\|WTF_CSRF_ENABLED.*False\|csrf.*disable" --include="*.py"
```

---

## Testing Checklist

- [ ] All state-changing requests require POST/PUT/DELETE
- [ ] CSRF tokens included in all forms
- [ ] CSRF tokens validated on submission
- [ ] SameSite cookie attribute set (Lax or Strict)
- [ ] Custom headers required for API requests
- [ ] Origin/Referer validated as secondary defense
- [ ] Fetch Metadata headers checked where supported
- [ ] CORS properly configured (no wildcard with credentials)
- [ ] Token not exposed in URL/logs
- [ ] GET requests never change state

---

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [CWE-352: Cross-Site Request Forgery](https://cwe.mitre.org/data/definitions/352.html)
- [Fetch Metadata Headers](https://web.dev/fetch-metadata/)
- [SameSite Cookies Explained](https://web.dev/samesite-cookies-explained/)
