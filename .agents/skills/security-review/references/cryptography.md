# Cryptographic Security Reference

## Core Principles

1. **Avoid storing sensitive data** when possible - the best protection is not having the data
2. **Use established libraries** - never implement cryptographic algorithms yourself
3. **Use modern algorithms** - avoid deprecated algorithms even if they seem convenient
4. **Manage keys securely** - key management is often harder than encryption itself

## Encryption Algorithms

### Symmetric Encryption

**Recommended:**
- **AES-256-GCM** (preferred) - Provides encryption + authentication
- **AES-128-GCM** - Acceptable minimum
- **ChaCha20-Poly1305** - Good alternative, especially on systems without AES hardware

**Avoid:**
- DES, 3DES - Deprecated, insufficient key length
- RC4 - Broken
- AES-ECB - Reveals patterns in data
- AES-CBC without authentication - Vulnerable to padding oracle attacks

### Cipher Modes

| Mode | Use Case | Notes |
|------|----------|-------|
| **GCM** | General purpose | Authenticated encryption (preferred) |
| **CCM** | Constrained environments | Authenticated encryption |
| **CTR + HMAC** | When GCM unavailable | Encrypt-then-MAC pattern |
| **CBC** | Legacy only | Requires separate MAC |
| **ECB** | Never for data | Reveals patterns |

```python
# VULNERABLE: ECB mode
from Crypto.Cipher import AES
cipher = AES.new(key, AES.MODE_ECB)

# SAFE: GCM mode
cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
ciphertext, tag = cipher.encrypt_and_digest(plaintext)
```

### Asymmetric Encryption

**Recommended:**
- **ECC with Curve25519** (preferred for key exchange)
- **RSA-2048** minimum (RSA-4096 for long-term)
- **ECDSA with P-256** or Ed25519 for signatures

**Avoid:**
- RSA < 2048 bits
- DSA
- ECDSA with weak curves

---

## Secure Random Number Generation

### Cryptographically Secure PRNGs (CSPRNG)

| Language | Safe | Unsafe |
|----------|------|--------|
| **Python** | `secrets`, `os.urandom()` | `random` module |
| **JavaScript** | `crypto.randomBytes()`, `crypto.randomUUID()` | `Math.random()` |
| **Java** | `SecureRandom`, `UUID.randomUUID()` | `Math.random()`, `java.util.Random` |
| **PHP** | `random_bytes()`, `random_int()` | `rand()`, `mt_rand()`, `uniqid()` |
| **.NET** | `RandomNumberGenerator` | `Random()` |
| **Go** | `crypto/rand` | `math/rand` |
| **Ruby** | `SecureRandom` | `rand()` |

```python
# VULNERABLE: Predictable random
import random
token = ''.join(random.choices(string.ascii_letters, k=32))

# SAFE: Cryptographically secure
import secrets
token = secrets.token_urlsafe(32)
```

### UUID Considerations

- **UUID v1**: NOT random - contains timestamp and MAC address
- **UUID v4**: Depends on implementation - verify CSPRNG usage
- **ULID**: Time-sortable but predictable time component

```python
# Check if UUID v4 is actually random
import uuid
# uuid.uuid4() uses os.urandom() in Python - SAFE
token = str(uuid.uuid4())
```

---

## Key Management

### Key Generation

```python
# VULNERABLE: Key from password directly
key = password.encode()

# SAFE: Key derivation function
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
kdf = PBKDF2HMAC(
    algorithm=hashes.SHA256(),
    length=32,
    salt=salt,
    iterations=600000,
)
key = kdf.derive(password.encode())
```

### Key Storage

**Do:**
- Use Hardware Security Modules (HSM)
- Use cloud key management (AWS KMS, Azure Key Vault, GCP KMS)
- Use dedicated secrets managers (HashiCorp Vault)
- Store keys separately from encrypted data

**Don't:**
- Hardcode keys in source code
- Commit keys to version control
- Store keys in environment variables (can leak)
- Store keys in plaintext files

```python
# VULNERABLE: Hardcoded key
KEY = b'super_secret_key_12345'

# VULNERABLE: Key in code as base64
KEY = base64.b64decode('c3VwZXJfc2VjcmV0X2tleQ==')

# SAFE: Load from secure source
KEY = secrets_manager.get_secret('encryption_key')
```

### Key Rotation

**When to rotate:**
- Key compromise (immediate)
- Cryptoperiod expiration (time-based)
- After encrypting 2^35 bytes (for 64-bit block ciphers)
- Algorithm deprecation

**Rotation strategies:**

1. **Re-encryption** (preferred): Decrypt with old key, re-encrypt with new
2. **Versioning**: Tag encrypted items with key version, maintain multiple keys

### Envelope Encryption

```python
# Two-key structure:
# - Data Encryption Key (DEK): Encrypts actual data
# - Key Encryption Key (KEK): Encrypts the DEK

def encrypt_with_envelope(plaintext, kek):
    # Generate random DEK
    dek = secrets.token_bytes(32)

    # Encrypt data with DEK
    cipher = AES.new(dek, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)

    # Encrypt DEK with KEK
    kek_cipher = AES.new(kek, AES.MODE_GCM)
    encrypted_dek, dek_tag = kek_cipher.encrypt_and_digest(dek)

    # Store encrypted_dek with ciphertext
    return {
        'ciphertext': ciphertext,
        'tag': tag,
        'encrypted_dek': encrypted_dek,
        'dek_tag': dek_tag,
        'nonce': cipher.nonce,
        'dek_nonce': kek_cipher.nonce
    }
```

---

## Hashing

### Password Hashing

See `authentication.md` for password-specific hashing.

### General Purpose Hashing

| Use Case | Algorithm |
|----------|-----------|
| Integrity verification | SHA-256 or SHA-3 |
| HMAC | HMAC-SHA-256 |
| Key derivation | HKDF, PBKDF2 |
| Content addressing | SHA-256 |

**Avoid for new systems:**
- MD5 (broken)
- SHA-1 (deprecated)

```python
# For integrity/checksums
import hashlib
digest = hashlib.sha256(data).hexdigest()

# For authentication (HMAC)
import hmac
mac = hmac.new(key, data, hashlib.sha256).digest()
```

---

## Common Vulnerabilities

### Weak Algorithm Usage

```python
# VULNERABLE: MD5 for security purposes
import hashlib
checksum = hashlib.md5(data).hexdigest()

# VULNERABLE: SHA1 for signatures
signature = hashlib.sha1(data + secret).hexdigest()

# SAFE: SHA-256
checksum = hashlib.sha256(data).hexdigest()
```

### Insufficient Key Size

```python
# VULNERABLE: Short key
key = b'short_key'  # 9 bytes

# SAFE: Adequate key length
key = secrets.token_bytes(32)  # 256 bits
```

### Predictable IV/Nonce

```python
# VULNERABLE: Reused or predictable nonce
nonce = b'\x00' * 12  # Static nonce

# VULNERABLE: Counter-based without persistence
nonce = counter.to_bytes(12, 'big')

# SAFE: Random nonce
nonce = secrets.token_bytes(12)
```

### ECB Mode Patterns

```python
# VULNERABLE: ECB reveals patterns
cipher = AES.new(key, AES.MODE_ECB)

# SAFE: GCM hides patterns
cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
```

### Missing Authentication

```python
# VULNERABLE: Encryption without authentication
cipher = AES.new(key, AES.MODE_CBC, iv=iv)
ciphertext = cipher.encrypt(pad(plaintext, 16))
# Vulnerable to bit-flipping, padding oracle

# SAFE: Authenticated encryption
cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
ciphertext, tag = cipher.encrypt_and_digest(plaintext)
```

---

## Grep Patterns for Detection

```bash
# Weak algorithms
grep -rn "MD5\|md5\|SHA1\|sha1\|DES\|des\|RC4\|rc4" --include="*.py" --include="*.js"
grep -rn "MODE_ECB\|ecb" --include="*.py" --include="*.js"

# Insecure random
grep -rn "Math\.random\|random\.random\|random\.randint" --include="*.py" --include="*.js"
grep -rn "mt_rand\|rand()" --include="*.php"

# Hardcoded keys
grep -rn "key\s*=\s*['\"]" --include="*.py" --include="*.js"
grep -rn "secret\s*=\s*['\"]" --include="*.py" --include="*.js"
grep -rn "AES\.new.*b'" --include="*.py"

# Static IVs/nonces
grep -rn "iv\s*=\s*b'\|nonce\s*=\s*b'" --include="*.py"
grep -rn "\\x00.*\\x00.*\\x00" --include="*.py"

# CBC without HMAC
grep -rn "MODE_CBC" --include="*.py" | grep -v "hmac\|mac\|tag"
```

---

## Testing Checklist

- [ ] No hardcoded keys/secrets in source code
- [ ] Keys not committed to version control
- [ ] Using modern algorithms (AES-GCM, RSA-2048+, SHA-256+)
- [ ] CSPRNG used for all security-sensitive randomness
- [ ] Keys stored securely (HSM, KMS, secrets manager)
- [ ] Key rotation mechanism exists
- [ ] No ECB mode usage
- [ ] Authenticated encryption used (GCM, or encrypt-then-MAC)
- [ ] Adequate key lengths (256-bit symmetric, 2048+ RSA)
- [ ] IVs/nonces are random and never reused with same key

---

## References

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [CWE-327: Use of Broken Crypto Algorithm](https://cwe.mitre.org/data/definitions/327.html)
- [CWE-330: Insufficient Randomness](https://cwe.mitre.org/data/definitions/330.html)
- [CWE-321: Hard-coded Cryptographic Key](https://cwe.mitre.org/data/definitions/321.html)
