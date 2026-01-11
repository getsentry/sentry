"""
Demonstration: Bug vs Fix

This file demonstrates the bug and the fix side by side.
"""

# THE BUG: Returning a dict when a Pydantic model is expected
def create_connection_request_buggy(from_user_id: str, to_user_id: str, message: str) -> dict:
    """
    BUG VERSION: Returns a dict instead of a Pydantic model.
    
    When the calling code tries to call .model_dump() on this return value,
    it will fail with: AttributeError: 'dict' object has no attribute 'model_dump'
    """
    import uuid
    from datetime import datetime
    
    return {
        "id": str(uuid.uuid4()),
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "message": message,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


# THE FIX: Returning a Pydantic model
def create_connection_request_fixed(from_user_id: str, to_user_id: str, message: str):
    """
    FIXED VERSION: Returns a ConnectionRequest Pydantic model.
    
    Now the calling code can safely call .model_dump() on this return value.
    """
    import uuid
    from datetime import datetime
    from api.schemas import ConnectionRequest
    
    connection_request_data = {
        "id": str(uuid.uuid4()),
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "message": message,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    return ConnectionRequest(**connection_request_data)


if __name__ == "__main__":
    print("="*70)
    print("DEMONSTRATING THE BUG")
    print("="*70)
    
    # Test the buggy version
    print("\n1. Testing buggy version that returns a dict:")
    result_buggy = create_connection_request_buggy("user1", "user2", "Hello")
    print(f"   Type: {type(result_buggy)}")
    print(f"   Result: {result_buggy}")
    
    try:
        result_buggy.model_dump()
        print("   ✗ Unexpected: model_dump() worked (should have failed)")
    except AttributeError as e:
        print(f"   ✓ Expected error: {e}")
    
    print("\n" + "="*70)
    print("DEMONSTRATING THE FIX")
    print("="*70)
    
    # Test the fixed version
    print("\n2. Testing fixed version that returns a Pydantic model:")
    import sys
    sys.path.insert(0, '/workspace')
    
    result_fixed = create_connection_request_fixed("user1", "user2", "Hello")
    print(f"   Type: {type(result_fixed)}")
    print(f"   Result: {result_fixed}")
    
    try:
        dumped = result_fixed.model_dump()
        print(f"   ✓ Success: model_dump() works correctly")
        print(f"   Dumped data: {dumped}")
    except AttributeError as e:
        print(f"   ✗ Unexpected error: {e}")
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print("""
The bug occurred because create_connection_request returned a plain dict,
but the calling code expected a Pydantic model with a model_dump() method.

The fix was to change create_connection_request to return a ConnectionRequest
Pydantic model instance instead of a dict.

Root cause: Type mismatch between service layer (dict) and API layer (Pydantic model)
Solution: Make service layer return proper Pydantic models
    """)
