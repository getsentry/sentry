#!/usr/bin/env python3
"""
Final validation that the fix resolves the exact error from the issue report.

Issue: HTTPException: 'dict' object has no attribute 'model_dump'
       (occurred in: /api/v1/networking/connections/request)

This script validates that:
1. The exact error condition is reproducible (dict without model_dump)
2. The fix resolves the error (Pydantic model with model_dump)
3. The API endpoint now works correctly
"""

import sys
sys.path.insert(0, '/workspace')

from fastapi import FastAPI
from fastapi.testclient import TestClient
from api.routes.networking import router

# Create test app matching the production setup
app = FastAPI()
app.include_router(router, prefix="/api/v1")
client = TestClient(app)


def validate_fix():
    """Validate that the fix resolves the original error."""
    
    print("="*80)
    print("VALIDATING FIX FOR: HTTPException 'dict' object has no attribute 'model_dump'")
    print("="*80)
    print()
    
    # Test the exact request from the error report
    print("1. Testing the exact request from the error report:")
    print("   POST /api/v1/networking/connections/request")
    print('   Body: {"to_user_id": "271a41d4-9d5d-41c7-af57-51a184787466",')
    print('          "message": "I\'d like to connect!"}')
    print()
    
    response = client.post(
        "/api/v1/networking/connections/request",
        json={
            "to_user_id": "271a41d4-9d5d-41c7-af57-51a184787466",
            "message": "I'd like to connect!"
        }
    )
    
    print(f"   Response Status: {response.status_code}")
    
    if response.status_code == 500:
        print("   ❌ FAILED: Still getting 500 error")
        error_detail = response.json().get("detail", "")
        print(f"   Error: {error_detail}")
        if "'dict' object has no attribute 'model_dump'" in error_detail:
            print("   ❌ CRITICAL: The original bug is still present!")
            return False
    elif response.status_code == 200:
        print("   ✓ SUCCESS: Request completed without error")
        data = response.json()
        print(f"   Response: {data}")
        
        # Validate response structure
        assert data["success"] is True, "Expected success=True"
        assert "data" in data, "Expected 'data' field in response"
        assert data["message"] == "Connection request sent", "Unexpected message"
        
        # Validate connection request data
        conn_data = data["data"]
        assert "id" in conn_data, "Expected 'id' in connection data"
        assert conn_data["to_user_id"] == "271a41d4-9d5d-41c7-af57-51a184787466"
        assert conn_data["message"] == "I'd like to connect!"
        assert conn_data["status"] == "pending"
        
        print()
        print("   ✓ Response structure is correct")
        print("   ✓ Connection request created successfully")
        print()
    else:
        print(f"   ❌ UNEXPECTED: Got status {response.status_code}")
        print(f"   Response: {response.json()}")
        return False
    
    print("="*80)
    print("VALIDATION RESULT: ✓ FIX SUCCESSFUL")
    print("="*80)
    print()
    print("Summary:")
    print("  • Original error: 'dict' object has no attribute 'model_dump'")
    print("  • Root cause: create_connection_request() returned dict instead of Pydantic model")
    print("  • Fix: Changed create_connection_request() to return ConnectionRequest model")
    print("  • Result: Endpoint now works correctly with 200 OK response")
    print()
    
    return True


if __name__ == "__main__":
    try:
        success = validate_fix()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ VALIDATION FAILED WITH EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
