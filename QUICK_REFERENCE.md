# Quick Reference: UUID Fix

## The Problem

```python
# ❌ BROKEN CODE
user_id = "00000000-0000-0000-0000-000000000001"  # String!
query.filter(Model.user_id == user_id)  # AttributeError!
```

## The Solution

```python
# ✅ FIXED CODE
from api.utils import ensure_uuid

user_id = "00000000-0000-0000-0000-000000000001"  # String
user_id = ensure_uuid(user_id)  # Convert to UUID object
query.filter(Model.user_id == user_id)  # Works!
```

## Quick Fix Pattern

```python
# At the start of any function that queries with UUIDs:
from api.utils import ensure_uuid

def my_function(user_id, config_id=None):
    # Convert all UUID parameters
    user_id = ensure_uuid(user_id)
    config_id = ensure_uuid(config_id) if config_id else None
    
    # Now safe to use in queries
    results = db.query(Model).filter(
        Model.user_id == user_id,
        Model.config_id == config_id
    ).all()
```

## Utility Functions

```python
from api.utils import (
    ensure_uuid,      # str/UUID/None → UUID/None
    uuid_to_str,      # UUID → str (for JSON)
    is_valid_uuid,    # Check if valid UUID
    generate_uuid,    # Create new UUID object
    generate_uuid_str # Create new UUID string
)

# Examples
user_id = ensure_uuid("00000000-0000-0000-0000-000000000001")
user_id_str = uuid_to_str(user_id)
is_valid = is_valid_uuid(user_id)
new_id = generate_uuid()
```

## Type Hints

```python
from uuid import UUID
from typing import Optional

def process_user(user_id: UUID) -> dict:
    """Type hint makes it clear: expects UUID object, not string."""
    pass

def optional_config(config_id: Optional[UUID] = None) -> dict:
    """Optional UUID parameter."""
    pass
```

## FastAPI/Pydantic

```python
from pydantic import BaseModel
from uuid import UUID

class MyRequest(BaseModel):
    user_id: UUID          # Pydantic auto-converts strings
    config_id: UUID | None = None

@router.post("/endpoint")
async def endpoint(request: MyRequest):
    # request.user_id is already a UUID object!
    # But double-check for safety:
    user_id = ensure_uuid(request.user_id)
```

## SQLAlchemy Models

```python
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy import Column

class MyModel(Base):
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    user_id = Column(PostgreSQLUUID(as_uuid=True), nullable=False)
```

## Common Patterns

### API Endpoint

```python
@router.post("/sync")
async def sync(request: Request, db: Session = Depends(get_db)):
    user_id = get_current_user_id(request)
    user_id = ensure_uuid(user_id)  # THE FIX
    
    configs = db.query(Config).filter(
        Config.user_id == user_id
    ).all()
```

### Optional Parameters

```python
def get_configs(user_id: str, config_id: str = None):
    user_id = ensure_uuid(user_id)
    
    query = db.query(Config).filter(Config.user_id == user_id)
    
    if config_id:
        config_id = ensure_uuid(config_id)
        query = query.filter(Config.id == config_id)
    
    return query.all()
```

### Multiple UUIDs

```python
from api.utils import UUIDConverter

def process_multiple(user_id, org_id, project_id):
    with UUIDConverter() as converter:
        user_id = converter.convert(user_id)
        org_id = converter.convert(org_id)
        project_id = converter.convert(project_id)
        
        # All safe to use now
        results = query.filter(...)
```

### JSON Response

```python
from api.utils import uuid_to_str

@router.get("/user/{user_id}")
async def get_user(user_id: UUID):
    user_id = ensure_uuid(user_id)
    user = db.query(User).filter(User.id == user_id).first()
    
    return {
        "user_id": uuid_to_str(user.id),  # Convert for JSON
        "name": user.name
    }
```

## Testing

```python
import uuid
from api.utils import ensure_uuid

def test_uuid_conversion():
    # Test string input
    result = ensure_uuid("00000000-0000-0000-0000-000000000001")
    assert isinstance(result, uuid.UUID)
    
    # Test UUID input
    uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
    result = ensure_uuid(uuid_obj)
    assert result == uuid_obj
    
    # Test None input
    result = ensure_uuid(None)
    assert result is None
```

## Error Handling

```python
from api.utils import ensure_uuid, is_valid_uuid

def safe_query(user_id_str: str):
    # Validate first
    if not is_valid_uuid(user_id_str):
        raise ValueError(f"Invalid UUID: {user_id_str}")
    
    # Convert
    try:
        user_id = ensure_uuid(user_id_str)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Use in query
    return db.query(User).filter(User.id == user_id).first()
```

## Checklist

When working with UUIDs in SQLAlchemy:

- [ ] Import `ensure_uuid` from `api.utils`
- [ ] Convert all UUID parameters at function start
- [ ] Use UUID objects in all query filters
- [ ] Add type hints: `UUID` for required, `Optional[UUID]` for optional
- [ ] Convert back to string for JSON responses with `uuid_to_str`
- [ ] Test with both string and UUID inputs

## Files to Review

- `/workspace/api/utils.py` - Utility functions
- `/workspace/api/routes/email_monitoring.py` - Example implementation
- `/workspace/EMAIL_MONITORING_UUID_FIX.md` - Detailed documentation
- `/workspace/SOLUTION.md` - Complete solution overview
