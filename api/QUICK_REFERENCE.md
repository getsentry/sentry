# UUID Fix - Quick Reference Card

## The Error
```
StatementError: (builtins.AttributeError) 'str' object has no attribute 'hex'
Location: /api/v1/email-monitoring/config
```

## The Fix (One Line)
```python
return UUID(user_id_str)  # Instead of: return user_id_str
```

## Complete Fix
```python
from uuid import UUID

def get_user_id_from_token(db: Session) -> UUID:
    user_id_str = extract_from_token()
    return UUID(user_id_str)  # ← Convert string to UUID
```

## Why It Works
- SQLAlchemy UUID columns with `as_uuid=True` expect UUID objects
- UUID objects have `.hex` attribute that SQLAlchemy calls
- Strings don't have `.hex` attribute → AttributeError

## Quick Test
```python
# ✅ This works
from uuid import UUID
user_id = UUID("00000000-0000-0000-0000-000000000001")
configs = db.query(Model).filter(Model.user_id == user_id).all()

# ❌ This fails
user_id = "00000000-0000-0000-0000-000000000001"
configs = db.query(Model).filter(Model.user_id == user_id).all()
```

## Files to Check
1. `api/routes/email_monitoring.py` - Main implementation
2. `api/SUMMARY.md` - Complete overview
3. `api/uuid_fix_demo.py` - Run this to see the fix in action

## Run Demo
```bash
cd /workspace/api
python uuid_fix_demo.py
```

## Run Tests
```bash
pip install -r requirements.txt
pytest tests/test_email_monitoring_uuid_fix.py -v
```

## Type Hints Template
```python
from uuid import UUID
from sqlalchemy.orm import Session

def get_user_id_from_token(db: Session) -> UUID:
    """Always return UUID object, not string."""
    return UUID(token_user_id)
```

## Database Column
```python
from sqlalchemy.dialects.postgresql import UUID as PGUUID

user_id = Column(PGUUID(as_uuid=True), nullable=False)
```

## Status
✅ **FIXED** - Complete implementation with tests and documentation
