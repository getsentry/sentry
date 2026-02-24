# Authorization Security Reference

## Overview

Authorization verifies that a requested action or service is approved for a specific entity—distinct from authentication, which verifies identity. A user who has been authenticated is often not authorized to access every resource and perform every action.

## Core Principles

### 1. Deny by Default

Every permission must be explicitly granted. The default position is denial.

```python
# VULNERABLE: Implicit allow
def get_document(request, doc_id):
    return Document.objects.get(id=doc_id)

# SAFE: Explicit authorization
def get_document(request, doc_id):
    doc = Document.objects.get(id=doc_id)
    if not request.user.has_permission('read', doc):
        raise PermissionDenied()
    return doc
```

### 2. Enforce Least Privilege

Assign users only the minimum necessary permissions for their role.

```python
# Define minimal permission sets
ROLE_PERMISSIONS = {
    'viewer': ['read'],
    'editor': ['read', 'write'],
    'admin': ['read', 'write', 'delete', 'admin']
}
```

### 3. Validate Permissions on Every Request

Never rely on UI hiding or client-side checks alone.

```python
# VULNERABLE: Authorization only on some endpoints
@app.route('/api/admin/users', methods=['GET'])
@require_admin  # Good
def list_users():
    pass

@app.route('/api/admin/users/<id>', methods=['DELETE'])
def delete_user(id):  # Missing authorization check!
    User.delete(id)

# SAFE: Consistent authorization
@app.route('/api/admin/users/<id>', methods=['DELETE'])
@require_admin  # Always check
def delete_user(id):
    User.delete(id)
```

---

## Insecure Direct Object References (IDOR)

### The Vulnerability

IDOR occurs when attackers access or modify objects by manipulating identifiers.

```python
# VULNERABLE: No ownership validation
@app.route('/api/orders/<order_id>')
def get_order(order_id):
    return Order.query.get(order_id).to_dict()

# Attack: User A accesses /api/orders/123 (User B's order)
```

### Prevention

**1. Validate Object Ownership**

```python
# SAFE: Scope queries to current user
@app.route('/api/orders/<order_id>')
def get_order(order_id):
    order = Order.query.filter_by(
        id=order_id,
        user_id=current_user.id  # Ownership check
    ).first_or_404()
    return order.to_dict()
```

**2. Use Indirect References**

```python
# Map user-specific indices to actual IDs
def get_user_order_map(user_id):
    orders = Order.query.filter_by(user_id=user_id).all()
    return {i: order.id for i, order in enumerate(orders)}

@app.route('/api/orders/<int:index>')
def get_order(index):
    order_map = get_user_order_map(current_user.id)
    real_id = order_map.get(index)
    if not real_id:
        raise NotFound()
    return Order.query.get(real_id).to_dict()
```

**3. Perform Object-Level Checks**

```python
# Check permission on the specific object, not just object type
def check_permission(user, action, resource):
    # Bad: Type-level check only
    # if user.can('read', 'Order'): return True

    # Good: Object-level check
    if resource.owner_id == user.id:
        return True
    if resource.organization_id in user.organization_ids:
        return user.has_org_permission(action, resource.organization_id)
    return False
```

---

## Access Control Models

### Role-Based Access Control (RBAC)

Simple but limited. Good for straightforward permission structures.

```python
ROLES = {
    'admin': {'create', 'read', 'update', 'delete'},
    'editor': {'create', 'read', 'update'},
    'viewer': {'read'}
}

def has_permission(user, action):
    return action in ROLES.get(user.role, set())
```

### Attribute-Based Access Control (ABAC)

More flexible. Supports complex policies with multiple attributes.

```python
def evaluate_policy(subject, action, resource, environment):
    """
    Subject: user attributes (role, department, clearance)
    Action: what they're trying to do
    Resource: object attributes (owner, classification, type)
    Environment: context (time, location, device)
    """
    # Example: Only managers can approve during business hours
    if action == 'approve':
        return (
            subject.role == 'manager' and
            resource.department == subject.department and
            environment.is_business_hours
        )
    return False
```

### Relationship-Based Access Control (ReBAC)

Access based on relationships between entities.

```python
# User can view document if:
# - They own it
# - They're in a group that has access
# - They're in the same organization
def can_view(user, document):
    if document.owner_id == user.id:
        return True
    if user.groups.intersection(document.shared_with_groups):
        return True
    if document.org_id == user.org_id and document.org_visible:
        return True
    return False
```

---

## Common Vulnerabilities

### Horizontal Privilege Escalation

Accessing resources belonging to other users at the same privilege level.

```python
# VULNERABLE: User A can access User B's profile
@app.route('/api/profile/<user_id>')
def get_profile(user_id):
    return User.query.get(user_id).profile

# SAFE: Only access own profile
@app.route('/api/profile')
def get_profile():
    return current_user.profile
```

### Vertical Privilege Escalation

Accessing higher-privilege functionality.

```python
# VULNERABLE: Hidden admin endpoint
@app.route('/api/admin/delete-all')
def delete_all():
    # No authorization check
    Database.delete_all()

# SAFE: Explicit admin check
@app.route('/api/admin/delete-all')
@require_role('super_admin')
def delete_all():
    Database.delete_all()
```

### Path Traversal in Authorization

```python
# VULNERABLE: Path-based authorization bypass
@app.route('/files/<path:filepath>')
def get_file(filepath):
    # Attacker: /files/../../../etc/passwd
    return send_file(filepath)

# SAFE: Validate and sanitize path
@app.route('/files/<path:filepath>')
def get_file(filepath):
    base_dir = '/app/user_files'
    full_path = os.path.realpath(os.path.join(base_dir, filepath))
    if not full_path.startswith(base_dir):
        raise PermissionDenied()
    return send_file(full_path)
```

### Mass Assignment

```python
# VULNERABLE: User can set admin flag
@app.route('/api/users/<id>', methods=['PATCH'])
def update_user(id):
    user = User.query.get(id)
    user.update(**request.json)  # Includes is_admin!

# SAFE: Allowlist fields
@app.route('/api/users/<id>', methods=['PATCH'])
def update_user(id):
    ALLOWED_FIELDS = {'name', 'email', 'bio'}
    user = User.query.get(id)
    data = {k: v for k, v in request.json.items() if k in ALLOWED_FIELDS}
    user.update(**data)
```

---

## Implementation Patterns

### Middleware/Filter Pattern

```python
# Apply authorization consistently via middleware
class AuthorizationMiddleware:
    def process_request(self, request):
        if not self.is_authorized(request):
            raise PermissionDenied()

    def is_authorized(self, request):
        # Extract resource and action from request
        resource = self.get_resource(request)
        action = self.get_action(request)
        return request.user.has_permission(action, resource)
```

### Policy Objects

```python
class DocumentPolicy:
    def __init__(self, user, document):
        self.user = user
        self.document = document

    def can_view(self):
        return (
            self.document.is_public or
            self.document.owner_id == self.user.id or
            self.user.is_admin
        )

    def can_edit(self):
        return self.document.owner_id == self.user.id

    def can_delete(self):
        return self.document.owner_id == self.user.id or self.user.is_admin

# Usage
policy = DocumentPolicy(current_user, document)
if not policy.can_view():
    raise PermissionDenied()
```

---

## Grep Patterns for Detection

```bash
# Missing authorization checks
grep -rn "def get_\|def post_\|def put_\|def delete_" --include="*.py" | grep -v "@require\|@login\|permission"

# Direct object access without ownership check
grep -rn "\.get(.*id)\|\.filter(id=" --include="*.py" | grep -v "user_id\|owner"

# Mass assignment
grep -rn "\*\*request\.\|update(\*\*\|create(\*\*" --include="*.py"

# Path traversal risk
grep -rn "os\.path\.join.*request\|open(.*request" --include="*.py"

# Admin endpoints
grep -rn "admin\|superuser" --include="*.py" | grep "route\|endpoint"
```

---

## Authorization Testing

### Test Cases

1. **Horizontal access**: Can User A access User B's resources?
2. **Vertical access**: Can regular users access admin endpoints?
3. **Missing checks**: Are all endpoints protected?
4. **Parameter tampering**: Can IDs be manipulated?
5. **Path traversal**: Can file paths escape allowed directories?
6. **Mass assignment**: Can protected fields be modified?

### Test Automation

```python
def test_horizontal_access():
    user_a = create_user()
    user_b = create_user()
    resource = create_resource(owner=user_a)

    # User B should not access User A's resource
    client.login(user_b)
    response = client.get(f'/api/resources/{resource.id}')
    assert response.status_code == 403

def test_idor_enumeration():
    # Try sequential IDs
    for i in range(1, 100):
        response = client.get(f'/api/resources/{i}')
        if response.status_code == 200:
            # Should be denied or return 404, not 200
            assert False, f"IDOR vulnerability: /api/resources/{i}"
```

---

## References

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
- [CWE-639: Authorization Bypass Through User-Controlled Key](https://cwe.mitre.org/data/definitions/639.html)
- [CWE-862: Missing Authorization](https://cwe.mitre.org/data/definitions/862.html)
