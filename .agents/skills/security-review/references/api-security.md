# API Security Reference

## Overview

APIs expose application functionality and data, making them prime targets for attackers. This reference covers security for REST APIs, GraphQL, and general API patterns.

## Authentication

### Token-Based Authentication

```python
# JWT Best Practices
# 1. Use strong signing algorithms
# VULNERABLE: None algorithm
jwt.decode(token, algorithms=['none'])

# SAFE: Explicit algorithm
jwt.decode(token, secret_key, algorithms=['HS256'])

# 2. Validate standard claims
def validate_jwt(token):
    payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])

    # Validate issuer
    if payload.get('iss') != EXPECTED_ISSUER:
        raise ValueError("Invalid issuer")

    # Validate audience
    if payload.get('aud') != EXPECTED_AUDIENCE:
        raise ValueError("Invalid audience")

    # Validate expiration (jwt library does this automatically)
    # Validate not-before (jwt library does this automatically)

    return payload
```

### API Key Security

```python
# VULNERABLE: API key in URL (logged, cached, visible)
GET /api/users?api_key=secret123

# SAFE: API key in header
GET /api/users
Authorization: Bearer api_key_here
# Or
X-API-Key: api_key_here

# Server-side validation
def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or not validate_api_key(api_key):
            return jsonify({'error': 'Invalid API key'}), 401

        # Rate limit by API key
        if is_rate_limited(api_key):
            return jsonify({'error': 'Rate limit exceeded'}), 429

        return f(*args, **kwargs)
    return decorated
```

---

## Authorization

### Endpoint-Level Authorization

```python
# VULNERABLE: No authorization check
@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    return User.query.get(user_id).to_dict()

# SAFE: Authorization check
@app.route('/api/users/<user_id>', methods=['GET'])
@require_auth
def get_user(user_id):
    if not current_user.can_access_user(user_id):
        return jsonify({'error': 'Forbidden'}), 403
    return User.query.get(user_id).to_dict()
```

### Field-Level Authorization

```python
# VULNERABLE: All fields returned
@app.route('/api/users/<user_id>')
def get_user(user_id):
    user = User.query.get(user_id)
    return jsonify({
        'id': user.id,
        'email': user.email,
        'ssn': user.ssn,  # Sensitive!
        'is_admin': user.is_admin,  # Internal!
        'password_hash': user.password_hash  # NEVER expose!
    })

# SAFE: Filtered response based on permissions
@app.route('/api/users/<user_id>')
@require_auth
def get_user(user_id):
    user = User.query.get(user_id)

    response = {
        'id': user.id,
        'name': user.name,
    }

    # Add fields based on permissions
    if current_user.id == user_id or current_user.is_admin:
        response['email'] = user.email

    if current_user.is_admin:
        response['is_admin'] = user.is_admin

    return jsonify(response)
```

---

## Input Validation

### Request Validation

```python
from pydantic import BaseModel, validator, Field
from typing import Optional

class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., regex=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    age: Optional[int] = Field(None, ge=0, le=150)

    @validator('name')
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

@app.route('/api/users', methods=['POST'])
def create_user():
    try:
        data = CreateUserRequest(**request.json)
    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400

    # Process validated data
    return create_user_from_data(data)
```

### Content-Type Validation

```python
# VULNERABLE: Accept any content type
@app.route('/api/data', methods=['POST'])
def process_data():
    data = request.get_json()  # May fail silently

# SAFE: Validate content type
@app.route('/api/data', methods=['POST'])
def process_data():
    if request.content_type != 'application/json':
        return jsonify({'error': 'Content-Type must be application/json'}), 415

    data = request.get_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON'}), 400

    return process(data)
```

### Request Size Limits

```python
# Flask
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

# Express
app.use(express.json({ limit: '10mb' }))

# Handle large request errors
@app.errorhandler(413)
def request_too_large(e):
    return jsonify({'error': 'Request too large'}), 413
```

---

## Rate Limiting

### Implementation

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Endpoint-specific limits
@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")  # Prevent brute force
def login():
    pass

@app.route('/api/password-reset', methods=['POST'])
@limiter.limit("3 per hour")  # Prevent enumeration
def password_reset():
    pass

# Return proper headers
# X-RateLimit-Limit: 50
# X-RateLimit-Remaining: 45
# X-RateLimit-Reset: 1623456789
# Retry-After: 3600  (when limited)
```

### Rate Limit by API Key

```python
def get_rate_limit_key():
    # Prefer API key over IP for authenticated requests
    api_key = request.headers.get('X-API-Key')
    if api_key:
        return f"api_key:{api_key}"
    return f"ip:{get_remote_address()}"

limiter = Limiter(key_func=get_rate_limit_key)
```

---

## Mass Assignment Prevention

```python
# VULNERABLE: Accepting all fields
@app.route('/api/users/<id>', methods=['PATCH'])
def update_user(id):
    user = User.query.get(id)
    user.update(**request.json)  # Attacker sets is_admin=True
    return user.to_dict()

# SAFE: Allowlist of fields
ALLOWED_USER_FIELDS = {'name', 'email', 'bio'}

@app.route('/api/users/<id>', methods=['PATCH'])
def update_user(id):
    user = User.query.get(id)
    data = {k: v for k, v in request.json.items() if k in ALLOWED_USER_FIELDS}
    user.update(**data)
    return user.to_dict()

# BETTER: Use DTOs
class UserUpdateDTO(BaseModel):
    name: Optional[str]
    email: Optional[str]
    bio: Optional[str]
    # is_admin NOT included - can't be set

@app.route('/api/users/<id>', methods=['PATCH'])
def update_user(id):
    dto = UserUpdateDTO(**request.json)
    user = User.query.get(id)
    user.update(**dto.dict(exclude_unset=True))
    return user.to_dict()
```

---

## GraphQL Security

### Query Depth Limiting

```python
# VULNERABLE: Unbounded depth
# query { user { friends { friends { friends { ... } } } } }

# SAFE: Limit query depth
from graphql import validate
from graphql_core import depth_limit_validator

schema = build_schema(...)

def execute_query(query):
    errors = validate(
        schema,
        parse(query),
        [depth_limit_validator(max_depth=5)]
    )
    if errors:
        return {'errors': [str(e) for e in errors]}
    return graphql_sync(schema, query)
```

### Query Cost Analysis

```python
# Assign costs to fields and limit total cost
from graphene import ObjectType, Field, Int

class Query(ObjectType):
    user = Field(User, cost=1)
    users = Field(List(User), cost=lambda info, **args: args.get('limit', 10))
    expensive_query = Field(Report, cost=100)

# Reject queries exceeding cost threshold
MAX_QUERY_COST = 1000
```

### Disable Introspection in Production

```python
# VULNERABLE: Introspection enabled
# Attackers can discover entire schema

# SAFE: Disable introspection
from graphql import GraphQLSchema

class NoIntrospectionMiddleware:
    def resolve(self, next, root, info, **args):
        if info.field_name in ('__schema', '__type'):
            return None
        return next(root, info, **args)

# Or in configuration
app.config['GRAPHQL_INTROSPECTION'] = False
```

### Batching Attack Prevention

```python
# VULNERABLE: Allows unlimited batched mutations
# [
#   { "query": "mutation { login(user: 'a', pass: 'a') }" },
#   { "query": "mutation { login(user: 'a', pass: 'b') }" },
#   ...
# ]

# SAFE: Limit batch size
MAX_BATCH_SIZE = 10

@app.route('/graphql', methods=['POST'])
def graphql_endpoint():
    data = request.json

    if isinstance(data, list):
        if len(data) > MAX_BATCH_SIZE:
            return jsonify({'error': 'Batch size exceeded'}), 400
```

---

## Error Handling

### Generic Error Responses

```python
# VULNERABLE: Detailed errors
@app.errorhandler(Exception)
def handle_error(e):
    return jsonify({
        'error': str(e),
        'traceback': traceback.format_exc(),
        'query': last_query
    }), 500

# SAFE: Generic errors
@app.errorhandler(Exception)
def handle_error(e):
    # Log full details server-side
    app.logger.error(f"Error: {e}", exc_info=True)

    # Return generic message
    return jsonify({'error': 'An unexpected error occurred'}), 500

# Use RFC 7807 Problem Details
@app.errorhandler(404)
def not_found(e):
    return jsonify({
        'type': 'https://example.com/problems/not-found',
        'title': 'Resource Not Found',
        'status': 404,
        'detail': 'The requested resource was not found'
    }), 404
```

---

## Security Headers

```python
@app.after_request
def add_security_headers(response):
    # Prevent caching of sensitive data
    if request.endpoint in SENSITIVE_ENDPOINTS:
        response.headers['Cache-Control'] = 'no-store'

    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Content-Security-Policy'] = "default-src 'none'"

    return response
```

---

## CORS Configuration

```python
# VULNERABLE: Allow all origins
CORS(app, origins='*')

# VULNERABLE: Reflect origin header
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin')
    return response

# SAFE: Explicit allowlist
CORS(app, origins=[
    'https://app.example.com',
    'https://admin.example.com'
], supports_credentials=True)

# SAFE: Dynamic with validation
ALLOWED_ORIGINS = {'https://app.example.com', 'https://admin.example.com'}

@app.after_request
def add_cors(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response
```

---

## HTTP Methods

```python
# VULNERABLE: Method not enforced
@app.route('/api/users', methods=['GET', 'POST', 'PUT', 'DELETE'])
def users():
    pass

# SAFE: Explicit method handling
@app.route('/api/users', methods=['GET'])
def list_users():
    pass

@app.route('/api/users', methods=['POST'])
@require_auth
def create_user():
    pass

# Return 405 for unsupported methods
@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'error': 'Method not allowed'}), 405
```

---

## Grep Patterns for Detection

```bash
# Missing authentication
grep -rn "@app\.route\|@router\." --include="*.py" | grep -v "@require_auth\|@login_required"

# Returning all fields
grep -rn "to_dict()\|__dict__\|serialize" --include="*.py"

# Mass assignment
grep -rn "\*\*request\.\|update(\*\*\|create(\*\*" --include="*.py"

# Missing rate limiting
grep -rn "login\|password\|reset" --include="*.py" | grep "route" | grep -v "limiter\|rate"

# GraphQL introspection
grep -rn "__schema\|introspection" --include="*.py"

# CORS wildcards
grep -rn "origins.*\*\|Access-Control-Allow-Origin.*\*" --include="*.py"
```

---

## Testing Checklist

- [ ] All endpoints require authentication (except public ones)
- [ ] Authorization checked for every request
- [ ] Input validation on all parameters
- [ ] Response filtering (no sensitive data exposure)
- [ ] Rate limiting on authentication endpoints
- [ ] Rate limiting on resource-intensive endpoints
- [ ] Mass assignment prevented (field allowlists)
- [ ] Proper error handling (no information leakage)
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] HTTP methods restricted
- [ ] GraphQL depth/cost limiting (if applicable)
- [ ] GraphQL introspection disabled in production

---

## References

- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP GraphQL Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE-285: Improper Authorization](https://cwe.mitre.org/data/definitions/285.html)
