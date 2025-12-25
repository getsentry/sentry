"""Test to verify the fix for the OfferComparisonService TypeError.

This test demonstrates that the fix resolves the issue where
OfferComparisonService.add_offer() was not accepting the 'company' keyword argument.
"""
import asyncio
import sys
import os

# Add parent directory to path to import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.offer_comparison_service import OfferComparisonService


async def test_add_offer_with_company():
    """Test that add_offer now accepts the company parameter."""
    service = OfferComparisonService()
    
    print("Testing OfferComparisonService.add_offer() with company parameter...")
    
    # This was the failing call from the error trace
    result = await service.add_offer(
        company="Company A",  # This parameter now works!
        role="Senior Engineer",
        location="San Francisco",
        base_salary=180000.0,
        signing_bonus=25000.0,
        annual_bonus_target=0,
        equity_value=50000.0,
        equity_type="none",
        equity_vesting_years=4,
        work_arrangement="onsite",
    )
    
    print(f"✓ Success! Offer added with ID: {result['id']}")
    print(f"  Company: Company A")
    print(f"  Message: {result['message']}")
    print(f"  Total Compensation: ${result['total_compensation']:,.2f}")
    
    # Verify the offer was stored correctly
    stored_offer = await service.get_offer(result['id'])
    assert stored_offer is not None, "Offer should be stored"
    assert stored_offer['company'] == "Company A", "Company should match"
    assert stored_offer['role'] == "Senior Engineer", "Role should match"
    assert stored_offer['base_salary'] == 180000.0, "Salary should match"
    
    print("\n✓ All assertions passed!")
    print("\nFIX VERIFIED: The 'company' parameter is now properly accepted by add_offer()")
    return True


async def test_multiple_offers():
    """Test adding multiple offers and comparing them."""
    service = OfferComparisonService()
    
    print("\n\nTesting multiple offers comparison...")
    
    # Add first offer
    offer1 = await service.add_offer(
        company="Company A",
        role="Senior Engineer",
        location="San Francisco",
        base_salary=180000.0,
        signing_bonus=25000.0,
        equity_value=50000.0,
    )
    print(f"✓ Added offer from Company A: ${offer1['total_compensation']:,.2f}")
    
    # Add second offer
    offer2 = await service.add_offer(
        company="Company B",
        role="Staff Engineer",
        location="Remote",
        base_salary=200000.0,
        signing_bonus=30000.0,
        equity_value=100000.0,
        equity_vesting_years=4,
    )
    print(f"✓ Added offer from Company B: ${offer2['total_compensation']:,.2f}")
    
    # Add third offer
    offer3 = await service.add_offer(
        company="Company C",
        role="Senior Engineer",
        location="New York",
        base_salary=190000.0,
        signing_bonus=20000.0,
        equity_value=75000.0,
        annual_bonus_target=15,
    )
    print(f"✓ Added offer from Company C: ${offer3['total_compensation']:,.2f}")
    
    # Compare offers
    comparison = await service.compare_offers([offer1['id'], offer2['id'], offer3['id']])
    
    print("\n✓ Comparison completed!")
    print(f"  Best offer: {comparison['best_offer']['company']} "
          f"with ${comparison['best_offer']['total_compensation']:,.2f}")
    
    return True


async def main():
    """Run all tests."""
    print("="*70)
    print("TESTING FIX FOR: TypeError - add_offer() got unexpected keyword 'company'")
    print("="*70)
    
    try:
        await test_add_offer_with_company()
        await test_multiple_offers()
        
        print("\n" + "="*70)
        print("ALL TESTS PASSED! ✓")
        print("="*70)
        print("\nSUMMARY OF THE FIX:")
        print("-" * 70)
        print("ISSUE: OfferComparisonService.add_offer() did not accept 'company' parameter")
        print("FIX:   Added 'company: str' parameter to the method signature")
        print("       Now the route handler can successfully pass company data to the service")
        print("-" * 70)
        return 0
        
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
