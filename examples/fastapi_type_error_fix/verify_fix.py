"""Simple verification script to demonstrate the fix without external dependencies."""

import asyncio
import inspect


def test_broken_service():
    """Test that the broken service is missing the parameter."""
    from service_broken import OfferComparisonService

    service = OfferComparisonService()
    sig = inspect.signature(service.compare_offers)
    params = list(sig.parameters.keys())

    print("Broken Service Parameters:")
    print(f"  {params}")

    # Check if priority_weights is missing
    if 'priority_weights' not in params:
        print("  ✗ Missing 'priority_weights' parameter - This will cause TypeError!")
        return False
    else:
        print("  ✓ Has 'priority_weights' parameter")
        return True


def test_fixed_service():
    """Test that the fixed service has all required parameters."""
    from service_fixed import OfferComparisonService

    service = OfferComparisonService()
    sig = inspect.signature(service.compare_offers)
    params = list(sig.parameters.keys())

    print("\nFixed Service Parameters:")
    print(f"  {params}")

    # Check if all required parameters are present
    required_params = ['offer_ids', 'priority_weights', 'target_location']
    missing = [p for p in required_params if p not in params]

    if missing:
        print(f"  ✗ Missing parameters: {missing}")
        return False
    else:
        print("  ✓ All required parameters present")
        return True


async def test_service_execution():
    """Test that the fixed service can be called with all parameters."""
    from service_fixed import OfferComparisonService

    service = OfferComparisonService()

    print("\nTesting service execution:")

    try:
        # Call with all parameters (simulating the route handler)
        result = await service.compare_offers(
            offer_ids=["31276793-62bb-49a3-b850-62f58f092c68", "63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b"],
            priority_weights={"salary": 0.4, "location": 0.3, "benefits": 0.3},
            target_location="San Francisco"
        )

        print(f"  ✓ Service executed successfully")
        print(f"  Result: {result}")
        return True

    except TypeError as e:
        print(f"  ✗ TypeError occurred: {e}")
        return False


async def test_broken_service_execution():
    """Test that the broken service fails when called with priority_weights."""
    from service_broken import OfferComparisonService

    service = OfferComparisonService()

    print("\nTesting broken service execution:")

    try:
        # This should fail with TypeError
        result = await service.compare_offers(
            offer_ids=["31276793-62bb-49a3-b850-62f58f092c68", "63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b"],
            priority_weights={"salary": 0.4, "location": 0.3, "benefits": 0.3},
            target_location="San Francisco"
        )

        print(f"  ✗ Service should have failed but didn't!")
        return False

    except TypeError as e:
        print(f"  ✓ Expected TypeError occurred: {e}")
        return True


def main():
    """Run all verification tests."""
    print("=" * 70)
    print("FastAPI TypeError Fix Verification")
    print("=" * 70)

    # Test 1: Check broken service parameters
    broken_missing = not test_broken_service()

    # Test 2: Check fixed service parameters
    fixed_complete = test_fixed_service()

    # Test 3: Execute broken service (should fail)
    broken_fails = asyncio.run(test_broken_service_execution())

    # Test 4: Execute fixed service (should succeed)
    fixed_works = asyncio.run(test_service_execution())

    print("\n" + "=" * 70)
    print("Summary:")
    print("=" * 70)
    print(f"  Broken service missing parameter: {'✓' if broken_missing else '✗'}")
    print(f"  Fixed service has all parameters: {'✓' if fixed_complete else '✗'}")
    print(f"  Broken service fails as expected: {'✓' if broken_fails else '✗'}")
    print(f"  Fixed service works correctly:    {'✓' if fixed_works else '✗'}")

    all_passed = broken_missing and fixed_complete and broken_fails and fixed_works

    if all_passed:
        print("\n✅ All verifications passed! The fix is working correctly.")
        return 0
    else:
        print("\n❌ Some verifications failed!")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
