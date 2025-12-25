#!/usr/bin/env python3
"""Simple verification script for the RecruiterCRMService fix."""
import sys
import asyncio

# Add current directory to path
sys.path.insert(0, '/workspace')

from services.recruiter_crm_service import RecruiterCRMService


async def main():
    """Test the service methods."""
    print("Testing RecruiterCRMService...")
    
    service = RecruiterCRMService()
    
    # Test 1: get_pending_follow_ups without filters
    print("\n1. Testing get_pending_follow_ups() without filters...")
    result = await service.get_pending_follow_ups()
    print(f"   Result: {result}")
    assert "follow_ups" in result
    assert "total" in result
    assert "filters" in result
    print("   ✓ Pass")
    
    # Test 2: get_pending_follow_ups with priority
    print("\n2. Testing get_pending_follow_ups() with priority='high'...")
    result = await service.get_pending_follow_ups(priority="high")
    print(f"   Result: {result}")
    assert result["filters"]["priority"] == "high"
    print("   ✓ Pass")
    
    # Test 3: get_pending_follow_ups with due_before
    print("\n3. Testing get_pending_follow_ups() with due_before='2024-12-31'...")
    result = await service.get_pending_follow_ups(due_before="2024-12-31")
    print(f"   Result: {result}")
    assert result["filters"]["due_before"] == "2024-12-31"
    print("   ✓ Pass")
    
    # Test 4: get_pending_follow_ups with both filters
    print("\n4. Testing get_pending_follow_ups() with both filters...")
    result = await service.get_pending_follow_ups(priority="medium", due_before="2024-12-31")
    print(f"   Result: {result}")
    assert result["filters"]["priority"] == "medium"
    assert result["filters"]["due_before"] == "2024-12-31"
    print("   ✓ Pass")
    
    # Test 5: Check that the method exists
    print("\n5. Verifying the method exists...")
    assert hasattr(service, 'get_pending_follow_ups')
    print("   ✓ Pass - Method 'get_pending_follow_ups' exists on RecruiterCRMService")
    
    print("\n" + "="*60)
    print("All tests passed! ✓")
    print("="*60)
    print("\nThe AttributeError has been fixed!")
    print("The RecruiterCRMService now has the 'get_pending_follow_ups' method.")


if __name__ == "__main__":
    asyncio.run(main())
