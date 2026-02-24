# Authentication Security Reference

## Password Requirements

### Strength Requirements

| Context | Minimum Length | Maximum Length |
|---------|---------------|----------------|
| With MFA | 8 characters | At least 64 characters |
| Without MFA | 15 characters | At least 64 characters |

**Composition Rules:**
- Allow all printable characters including spaces and Unicode
- No mandatory complexity rules (uppercase, numbers, symbols)
- No periodic forced password changes
- Check against breached password databases (e.g., Have I Been Pwned)
- Implement password strength meters (e.g., zxcvbn)

### Password Storage

**Recommended Algorithms (in order of preference):**

1. **Argon2id** (preferred)
   ```
   Memory: minimum 19 MiB (19456 KB)
   Iterations: minimum 2
   Parallelism: 1
   ```

2. **scrypt**
   ```
   CPU/memory cost (N): 2^17
   Block size (r): 8
   Parallelization (p): 1
   ```

3. **bcrypt** (legacy systems)
   ```
   Work factor: minimum 10 (ideally 12+)
   Maximum password length: 72 bytes
   ```

4. **PBKDF2** (FIPS-required environments)
   ```
   Iterations: minimum 600,000 with HMAC-SHA-256
   ```

**Never Use:**
- MD5, SHA1, SHA256 without key stretching
- Plain hashing without salt
- Reversible encryption for passwords

### Vulnerable Patterns

```python
# VULNERABLE: MD5 hash
import hashlib
password_hash = hashlib.md5(password.encode()).hexdigest()

# VULNERABLE: SHA256 without salt/iterations
password_hash = hashlib.sha256(password.encode()).hexdigest()

# SAFE: bcrypt
import bcrypt
password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

# SAFE: Argon2
from argon2 import PasswordHasher
ph = PasswordHasher()
password_hash = ph.hash(password)
```

---

## Error Messages

### Generic Response Principle

Return identical error messages regardless of the specific failure reason.

**Login Responses:**
```
# WRONG: Reveals valid usernames
"User not found"
"Invalid password"
"Account locked"

# CORRECT: Generic message
"Login failed; Invalid user ID or password."
```

**Password Recovery:**
```
# WRONG: Reveals valid emails
"Email not found"
"Password reset email sent"

# CORRECT: Generic message
"If that email address is in our database, we will send you an email to reset your password."
```

**Account Creation:**
```
# WRONG: Reveals existing accounts
"Email already registered"

# CORRECT: Generic message
"A link to activate your account has been emailed to the address provided."
```

---

## Brute Force Protection

### Account Lockout

```python
# Configuration
LOCKOUT_THRESHOLD = 5  # Failed attempts before lockout
OBSERVATION_WINDOW = 15 * 60  # 15 minutes
LOCKOUT_DURATION = 30 * 60  # 30 minutes

# Implementation
class LoginAttemptTracker:
    def record_failed_attempt(self, account_id):
        # Track by account, NOT by IP
        # IP-based tracking allows bypassing via distributed attacks
        pass

    def is_locked(self, account_id):
        # Check if account is locked
        pass

    def allow_password_reset_when_locked(self):
        # Prevent lockout from becoming DoS
        return True
```

### Exponential Backoff

```python
def get_lockout_duration(failed_attempts):
    # Double duration with each lockout
    base_duration = 60  # 1 minute
    return base_duration * (2 ** (failed_attempts // LOCKOUT_THRESHOLD - 1))
```

### Rate Limiting

```python
# Per-IP rate limiting (defense in depth)
RATE_LIMIT = "10/minute"

# Per-account rate limiting
ACCOUNT_RATE_LIMIT = "5/minute"
```

---

## Multi-Factor Authentication

### MFA Effectiveness

Microsoft research indicates MFA blocks 99.9% of account compromises.

### MFA Implementation Checklist

- [ ] Require MFA for all users (not just optional)
- [ ] Support multiple MFA methods (TOTP, WebAuthn, SMS as fallback)
- [ ] Implement MFA bypass codes for recovery (store securely)
- [ ] Require re-authentication before disabling MFA
- [ ] Log all MFA events

### WebAuthn/FIDO2 (Preferred)

```javascript
// Registration
const publicKeyCredential = await navigator.credentials.create({
    publicKey: {
        challenge: serverChallenge,
        rp: { name: "Example Corp", id: "example.com" },
        user: { id: userId, name: username, displayName: displayName },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],  // ES256
        authenticatorSelection: { userVerification: "preferred" }
    }
});
```

**Benefits:**
- Phishing-resistant (bound to origin)
- No shared secrets to steal
- Hardware-backed security

---

## Session Security

### Session ID Requirements

- **Entropy**: Minimum 64 bits of randomness
- **Length**: At least 16 characters (hex) or 128 bits
- **Generation**: Cryptographically secure random generator only

```python
# VULNERABLE: Predictable session ID
session_id = str(user_id) + str(int(time.time()))

# SAFE: Cryptographically random
import secrets
session_id = secrets.token_hex(32)  # 256 bits
```

### Cookie Security Attributes

```
Set-Cookie: session_id=abc123;
    Secure;          # HTTPS only
    HttpOnly;        # No JavaScript access
    SameSite=Lax;    # CSRF protection
    Path=/;          # Scope
    Max-Age=3600;    # Expiration
```

### Session Lifecycle

```python
# VULNERABLE: Not regenerating session on login (Session Fixation)
def login(username, password):
    user = authenticate(username, password)
    session['user_id'] = user.id  # Same session ID - attacker can pre-set it!

# SAFE: Regenerate session ID after authentication
def login(user, password):
    if authenticate(user, password):
        # CRITICAL: Generate new session ID to prevent fixation
        session.regenerate()
        session['user_id'] = user.id

# Regenerate after privilege changes
def elevate_privileges():
    session.regenerate()
    session['is_admin'] = True

# Proper logout - invalidate both server and client
def logout():
    session.invalidate()  # Server-side invalidation
    response.delete_cookie('session_id')
```

### Session Timeouts

| Type | Purpose | Typical Value |
|------|---------|---------------|
| **Idle Timeout** | Inactive session | 15-30 minutes |
| **Absolute Timeout** | Maximum lifetime | 4-8 hours |

### Concurrent Session Control

```python
# Option 1: Allow only one session per user
def login(user):
    invalidate_all_sessions(user.id)
    return create_session(user)

# Option 2: Limit concurrent sessions
MAX_SESSIONS = 3
def login(user):
    sessions = get_sessions_by_user(user.id)
    if len(sessions) >= MAX_SESSIONS:
        oldest = min(sessions, key=lambda s: s['created_at'])
        invalidate_session(oldest['id'])
    return create_session(user)
```

---

## Re-authentication Requirements

Require fresh credentials before:
- Password changes
- Email address changes
- MFA configuration changes
- Sensitive financial transactions
- Account deletion

```python
def requires_recent_auth(max_age=300):  # 5 minutes
    """Decorator requiring recent authentication."""
    def decorator(f):
        def wrapper(*args, **kwargs):
            last_auth = session.get('last_auth_time')
            if not last_auth or time.time() - last_auth > max_age:
                raise ReauthenticationRequired()
            return f(*args, **kwargs)
        return wrapper
    return decorator

@requires_recent_auth(max_age=300)
def change_password(old_password, new_password):
    pass
```

---

## Email Address Changes

### With MFA Enabled

1. Verify current session authentication
2. Request MFA verification
3. Send notification to current email address
4. Send confirmation link to new email address
5. Require clicking link within time limit (e.g., 8 hours)

### Without MFA

1. Verify current session authentication
2. Require current password verification
3. Send notification to current email address
4. Send confirmation link to both addresses
5. Require confirmation from both within time limit

---

## Grep Patterns for Detection

```bash
# Weak hashing
grep -rn "md5\|sha1\|sha256" --include="*.py" --include="*.js" | grep -i password
grep -rn "hashlib\\.md5\|hashlib\\.sha" --include="*.py"

# Predictable session IDs
grep -rn "uuid1\|time\\(\\).*session\|user.*id.*session" --include="*.py"

# Missing cookie security
grep -rn "Set-Cookie" --include="*.py" --include="*.js" | grep -v -i "secure\|httponly"

# Error message leakage
grep -rn "not found\|invalid password\|does not exist" --include="*.py" --include="*.js"

# Session handling
grep -rn "session\\.regenerate\|regenerate_id\|new_session" --include="*.py" --include="*.php"
```

---

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [CWE-287: Improper Authentication](https://cwe.mitre.org/data/definitions/287.html)
- [CWE-384: Session Fixation](https://cwe.mitre.org/data/definitions/384.html)
