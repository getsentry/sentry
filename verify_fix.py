"""Simple verification script for the offer comparison fix"""
import asyncio
import sys
sys.path.insert(0, '/workspace')

from services.offer_comparison_service import OfferComparisonService


async def main():
    """Test the fixed list_offers method"""
    print("Testing OfferComparisonService.list_offers() method...")
    
    # Create service instance
    service = OfferComparisonService()
    
    # Test 1: Check that list_offers method exists
    print("\n1. Checking if list_offers method exists...")
    assert hasattr(service, 'list_offers'), "list_offers method is missing!"
    print("   ✓ list_offers method exists")
    
    # Test 2: Call list_offers with default limit
    print("\n2. Calling list_offers() with default limit...")
    result = await service.list_offers()
    print(f"   ✓ Method executed successfully")
    print(f"   Result: {result}")
    
    # Test 3: Verify result structure
    print("\n3. Verifying result structure...")
    assert 'success' in result, "Missing 'success' field"
    assert 'data' in result, "Missing 'data' field"
    assert 'offers' in result['data'], "Missing 'offers' field"
    assert 'total' in result['data'], "Missing 'total' field"
    assert 'limit' in result['data'], "Missing 'limit' field"
    print("   ✓ Result structure is correct")
    
    # Test 4: Call list_offers with custom limit
    print("\n4. Calling list_offers(limit=10)...")
    result = await service.list_offers(limit=10)
    assert result['data']['limit'] == 10, "Limit not applied correctly"
    print("   ✓ Custom limit works correctly")
    
    # Test 5: Create and list offers
    print("\n5. Creating offers and listing them...")
    await service.create_offer({
        "company": "Tech Corp",
        "position": "Senior Developer",
        "salary": 120000
    })
    await service.create_offer({
        "company": "Startup Inc",
        "position": "Lead Engineer",
        "salary": 130000
    })
    
    result = await service.list_offers()
    assert result['data']['total'] == 2, f"Expected 2 offers, got {result['data']['total']}"
    print(f"   ✓ Successfully created and listed {result['data']['total']} offers")
    
    # Test 6: Other methods
    print("\n6. Testing other service methods...")
    offer_result = await service.get_offer(1)
    assert offer_result is not None, "get_offer failed"
    print("   ✓ get_offer works")
    
    update_result = await service.update_offer(1, {"salary": 125000})
    assert update_result is not None, "update_offer failed"
    print("   ✓ update_offer works")
    
    compare_result = await service.compare_offers([1, 2])
    assert compare_result['success'], "compare_offers failed"
    print("   ✓ compare_offers works")
    
    delete_result = await service.delete_offer(1)
    assert delete_result, "delete_offer failed"
    print("   ✓ delete_offer works")
    
    print("\n" + "="*60)
    print("✓ ALL TESTS PASSED!")
    print("="*60)
    print("\nThe AttributeError has been fixed!")
    print("The OfferComparisonService now has the list_offers method.")
    

if __name__ == "__main__":
    asyncio.run(main())
