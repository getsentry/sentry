# Error Handling Security Reference

## Overview

Improper error handling can lead to information disclosure, denial of service, or security bypasses. This includes verbose error messages exposing internals, fail-open patterns that skip security checks on errors, and unhandled exceptions that crash services or leave systems in insecure states.

---

## Information Disclosure

### Stack Traces in Responses

```python
# VULNERABLE: Stack trace exposed to users
@app.errorhandler(Exception)
def handle_error(e):
    return f"Error: {traceback.format_exc()}", 500

# VULNERABLE: Detailed exception info
@app.route('/api/user/<id>')
def get_user(id):
    try:
        return User.query.get(id).to_dict()
    except Exception as e:
        return jsonify({
            'error': str(e),
            'type': type(e).__name__,
            'args': e.args
        }), 500
```

### Secure Error Handling

```python
# SAFE: Generic messages, detailed logging
import logging

logger = logging.getLogger(__name__)

@app.errorhandler(Exception)
def handle_error(e):
    # Log full details server-side
    logger.error(f"Unhandled exception: {e}", exc_info=True)

    # Return generic message to client
    return jsonify({'error': 'An internal error occurred'}), 500

# SAFE: Custom exceptions with safe messages
class UserNotFoundError(Exception):
    pass

@app.route('/api/user/<id>')
def get_user(id):
    try:
        user = User.query.get(id)
        if not user:
            raise UserNotFoundError()
        return user.to_dict()
    except UserNotFoundError:
        return jsonify({'error': 'User not found'}), 404
    except Exception:
        logger.exception("Error fetching user")
        return jsonify({'error': 'Internal error'}), 500
```

---

## Fail-Open Patterns

### Authentication Bypass on Error

```python
# VULNERABLE: Fail-open authentication
def authenticate(token):
    try:
        user = verify_token(token)
        return user
    except Exception:
        return None  # Returns None, might be treated as valid

# VULNERABLE: Exception allows bypass
def check_permission(user, resource):
    try:
        return permission_service.check(user, resource)
    except ServiceUnavailable:
        return True  # DANGEROUS: Allows access on service failure

# VULNERABLE: Default to authorized on error
@app.route('/admin')
def admin():
    try:
        if not is_admin(current_user):
            abort(403)
    except Exception:
        pass  # Silently continues to admin page
    return render_admin_panel()
```

### Secure Fail-Closed Patterns

```python
# SAFE: Fail-closed authentication
def authenticate(token):
    try:
        user = verify_token(token)
        if user is None:
            raise AuthenticationError("Invalid token")
        return user
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise AuthenticationError("Authentication failed")

# SAFE: Deny on service unavailable
def check_permission(user, resource):
    try:
        return permission_service.check(user, resource)
    except ServiceUnavailable:
        logger.error("Permission service unavailable")
        return False  # Deny access when unable to verify

# SAFE: Explicit denial on error
@app.route('/admin')
def admin():
    try:
        if not is_admin(current_user):
            abort(403)
    except Exception as e:
        logger.error(f"Admin check failed: {e}")
        abort(500)  # Don't proceed on error
    return render_admin_panel()
```

---

## Exception Swallowing

### Dangerous Patterns

```python
# VULNERABLE: Silent exception swallowing
try:
    validate_input(user_input)
except:
    pass  # Validation skipped entirely

# VULNERABLE: Catch-all hides security issues
try:
    result = dangerous_operation(user_data)
except Exception:
    result = default_value  # May hide injection attempts

# VULNERABLE: Empty except block
try:
    decrypt_sensitive_data(data)
except:
    pass  # Continues with encrypted/invalid data
```

### Secure Exception Handling

```python
# SAFE: Handle specific exceptions
try:
    validate_input(user_input)
except ValidationError as e:
    logger.warning(f"Validation failed: {e}")
    return jsonify({'error': 'Invalid input'}), 400
except Exception as e:
    logger.error(f"Unexpected validation error: {e}")
    return jsonify({'error': 'Validation error'}), 500

# SAFE: Never silently swallow security-critical exceptions
try:
    result = dangerous_operation(user_data)
except SecurityException as e:
    logger.error(f"Security exception: {e}")
    raise  # Re-raise security exceptions
except ValueError as e:
    logger.warning(f"Invalid data: {e}")
    result = None
```

---

## Differential Error Messages

### User Enumeration via Errors

```python
# VULNERABLE: Different messages reveal user existence
@app.route('/login', methods=['POST'])
def login():
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'User not found'}), 401  # Reveals user doesn't exist
    if not check_password(password, user.password):
        return jsonify({'error': 'Wrong password'}), 401  # Reveals user exists
    return create_session(user)

# VULNERABLE: Timing difference reveals user existence
def login(email, password):
    user = User.query.filter_by(email=email).first()
    if not user:
        return False  # Fast return
    return check_password(password, user.password)  # Slow hash check
```

### Secure Consistent Errors

```python
# SAFE: Consistent error messages
@app.route('/login', methods=['POST'])
def login():
    user = User.query.filter_by(email=email).first()
    if not user or not check_password(password, user.password):
        return jsonify({'error': 'Invalid credentials'}), 401  # Same message
    return create_session(user)

# SAFE: Constant-time comparison with dummy hash
DUMMY_HASH = generate_password_hash('dummy')

def login(email, password):
    user = User.query.filter_by(email=email).first()
    if user:
        valid = check_password(password, user.password)
    else:
        check_password(password, DUMMY_HASH)  # Constant time even if user not found
        valid = False
    return valid
```

---

## Resource Exhaustion via Errors

### Uncontrolled Exception Logging

```python
# VULNERABLE: Attacker can fill logs
@app.route('/api/data')
def get_data():
    try:
        return process_data(request.json)
    except Exception as e:
        # Logs entire request body - attacker sends huge payloads
        logger.error(f"Error processing: {request.json}")
        return jsonify({'error': 'Error'}), 500
```

### Secure Logging

```python
# SAFE: Limit logged data
@app.route('/api/data')
def get_data():
    try:
        return process_data(request.json)
    except Exception as e:
        # Log limited info, not full payload
        logger.error(f"Error processing request from {request.remote_addr}")
        return jsonify({'error': 'Error'}), 500
```

---

## Unhandled Async Exceptions

### Dangerous Patterns

```javascript
// VULNERABLE: Unhandled promise rejection
async function processUser(userId) {
    const user = await fetchUser(userId);  // No catch
    return user;
}

// VULNERABLE: Missing error handler
app.get('/api/data', async (req, res) => {
    const data = await fetchData();  // Unhandled rejection crashes server
    res.json(data);
});
```

### Secure Async Handling

```javascript
// SAFE: Always handle async errors
async function processUser(userId) {
    try {
        const user = await fetchUser(userId);
        return user;
    } catch (error) {
        logger.error('Failed to fetch user', { userId, error });
        throw new UserFetchError('Unable to fetch user');
    }
}

// SAFE: Express async wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/api/data', asyncHandler(async (req, res) => {
    const data = await fetchData();
    res.json(data);
}));

// Global handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason });
    // Don't exit - handle gracefully
});
```

---

## Error-Based SQL Injection Indicators

### Verbose Database Errors

```python
# VULNERABLE: Database errors exposed
@app.route('/api/search')
def search():
    try:
        results = db.execute(f"SELECT * FROM items WHERE name = '{query}'")
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        # Exposes: "syntax error at or near 'OR'" - reveals SQL injection possibility
```

### Secure Database Error Handling

```python
# SAFE: Generic database errors
@app.route('/api/search')
def search():
    try:
        results = db.execute("SELECT * FROM items WHERE name = %s", (query,))
        return jsonify(results)
    except DatabaseError as e:
        logger.error(f"Database error: {e}")
        return jsonify({'error': 'Search failed'}), 500
```

---

## Cleanup on Error

### Resource Leaks

```python
# VULNERABLE: Resource not cleaned up on error
def process_file(filename):
    f = open(filename)
    data = f.read()
    process(data)  # If this raises, file handle leaks
    f.close()

# VULNERABLE: Connection not returned to pool
def query_db():
    conn = pool.get_connection()
    result = conn.execute(query)  # If this raises, connection leaks
    pool.return_connection(conn)
    return result
```

### Secure Resource Management

```python
# SAFE: Context managers ensure cleanup
def process_file(filename):
    with open(filename) as f:
        data = f.read()
        process(data)  # File closed even on exception

# SAFE: Try-finally for cleanup
def query_db():
    conn = pool.get_connection()
    try:
        result = conn.execute(query)
        return result
    finally:
        pool.return_connection(conn)  # Always returns connection
```

---

## Grep Patterns for Detection

```bash
# Bare except clauses
grep -rn "except:" --include="*.py" | grep -v "except Exception"

# Empty exception handlers
grep -rn "except.*:\s*$" -A1 --include="*.py" | grep "pass"

# Stack traces in responses
grep -rn "traceback\|format_exc\|exc_info" --include="*.py" | grep -v "logger\|logging"

# Fail-open patterns
grep -rn "except.*:\s*$" -A2 --include="*.py" | grep "return True\|return None"

# Detailed error messages
grep -rn "str(e)\|str(err)\|e\.args\|e\.message" --include="*.py" | grep "return\|jsonify\|response"

# Differential error messages
grep -rn "not found\|does not exist\|invalid password\|wrong password" --include="*.py"

# Unhandled async
grep -rn "await.*[^;]$" --include="*.js" --include="*.ts" | grep -v "try\|catch"
```

---

## Testing Checklist

- [ ] No stack traces in production error responses
- [ ] All security checks fail-closed (deny on error)
- [ ] No empty except/catch blocks for security-critical code
- [ ] Consistent error messages for auth (no user enumeration)
- [ ] Async operations have error handlers
- [ ] Resources cleaned up on error (files, connections)
- [ ] Error logging doesn't include full user input
- [ ] Database errors don't expose query structure
- [ ] Rate limiting on error-generating endpoints

---

## References

- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- [CWE-209: Information Exposure Through Error Message](https://cwe.mitre.org/data/definitions/209.html)
- [CWE-755: Improper Handling of Exceptional Conditions](https://cwe.mitre.org/data/definitions/755.html)
- [CWE-636: Not Failing Securely](https://cwe.mitre.org/data/definitions/636.html)
