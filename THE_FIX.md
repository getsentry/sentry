# The Fix - Exact Code Diff

## `api/services.py`

### Before (Buggy Version)
```python
"""Service layer for connection requests."""
import uuid
from datetime import datetime
from typing import Dict


def create_connection_request(
    from_user_id: str,
    to_user_id: str,
    message: str
) -> Dict:
    """
    Create a connection request.
    
    BUG: This function returns a dict instead of a Pydantic model.
    The calling code expects a ConnectionRequest model with a model_dump() method.
    """
    # Simulating database insertion
    connection_request = {
        "id": str(uuid.uuid4()),
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "message": message,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # BUG: Returns a dict instead of ConnectionRequest model
    return connection_request
```

### After (Fixed Version)
```python
"""Service layer for connection requests."""
import uuid
from datetime import datetime

from api.schemas import ConnectionRequest  # ← ADDED


def create_connection_request(
    from_user_id: str,
    to_user_id: str,
    message: str
) -> ConnectionRequest:  # ← CHANGED from Dict
    """
    Create a connection request.
    
    FIXED: Now returns a ConnectionRequest Pydantic model instead of a dict.
    """
    # Simulating database insertion
    connection_request_data = {  # ← RENAMED for clarity
        "id": str(uuid.uuid4()),
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "message": message,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # FIXED: Return a ConnectionRequest Pydantic model
    return ConnectionRequest(**connection_request_data)  # ← CHANGED
```

### Unified Diff
```diff
--- api/services.py (before)
+++ api/services.py (after)
@@ -1,12 +1,11 @@
 """Service layer for connection requests."""
 import uuid
 from datetime import datetime
-from typing import Dict
+
+from api.schemas import ConnectionRequest
 
 
 def create_connection_request(
     from_user_id: str,
     to_user_id: str,
     message: str
-) -> Dict:
+) -> ConnectionRequest:
     """
     Create a connection request.
     
-    BUG: This function returns a dict instead of a Pydantic model.
-    The calling code expects a ConnectionRequest model with a model_dump() method.
+    FIXED: Now returns a ConnectionRequest Pydantic model instead of a dict.
     """
     # Simulating database insertion
-    connection_request = {
+    connection_request_data = {
         "id": str(uuid.uuid4()),
         "from_user_id": from_user_id,
         "to_user_id": to_user_id,
         "message": message,
         "status": "pending",
         "created_at": datetime.utcnow().isoformat(),
         "updated_at": datetime.utcnow().isoformat(),
     }
     
-    # BUG: Returns a dict instead of ConnectionRequest model
-    return connection_request
+    # FIXED: Return a ConnectionRequest Pydantic model
+    return ConnectionRequest(**connection_request_data)
```

## Changes Summary

**Lines Added:** 1 (import statement)
**Lines Modified:** 3 (return type, return statement, variable name)
**Lines Removed:** 1 (unused import)

**Total Changes:** 5 lines

**Impact:** 
- Before: HTTP 500 Error with AttributeError
- After: HTTP 200 OK with proper JSON response

**Complexity:** Low (simple type fix)
**Risk:** Minimal (makes code more type-safe)
