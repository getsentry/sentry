"""
Reproduces the exact scenario from the Sentry error report.

This script simulates the exact error that was reported:
- POST request to /api/v1/offer-comparison/compare
- With offer_ids in the request body
- The error: TypeError - unexpected keyword argument 'priority_weights'
"""

import asyncio
import sys


def test_exact_scenario():
    """Test the exact scenario from the error report."""
    print("=" * 70)
    print("Reproducing Exact Sentry Error Scenario")
    print("=" * 70)
    print("\nOriginal Error:")
    print("  TypeError: OfferComparisonService.compare_offers() got an")
    print("  unexpected keyword argument 'priority_weights'")
    print("\nRequest Body:")
    print("  {")
    print('    "offer_ids": [')
    print('      "31276793-62bb-49a3-b850-62f58f092c68",')
    print('      "63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b"')
    print("    ]")
    print("  }")
    print("\n" + "-" * 70)

    # Test with broken service
    print("\n1. Testing with BROKEN service (reproduces the error):")
    print("-" * 70)

    from service_broken import OfferComparisonService as BrokenService

    broken_service = BrokenService()

    try:
        # Simulate what the route handler does
        offer_ids = [
            "31276793-62bb-49a3-b850-62f58f092c68",
            "63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b"
        ]

        # The route passes priority_weights=None (from ComparisonRequest)
        # even though it wasn't in the request body
        result = asyncio.run(broken_service.compare_offers(
            offer_ids=offer_ids,
            priority_weights=None,  # This causes the TypeError!
            target_location=None
        ))

        print("❌ ERROR: Service should have raised TypeError but didn't!")
        return False

    except TypeError as e:
        error_msg = str(e)
        print(f"✓ Reproduced the exact error:")
        print(f"  TypeError: {error_msg}")

        # Verify it's the same error
        if "priority_weights" in error_msg and "unexpected keyword argument" in error_msg:
            print("\n✓ This matches the Sentry error report exactly!")
        else:
            print(f"\n❌ Different error than expected: {error_msg}")
            return False

    # Test with fixed service
    print("\n" + "-" * 70)
    print("2. Testing with FIXED service (should work):")
    print("-" * 70)

    from service_fixed import OfferComparisonService as FixedService

    fixed_service = FixedService()

    try:
        offer_ids = [
            "31276793-62bb-49a3-b850-62f58f092c68",
            "63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b"
        ]

        result = asyncio.run(fixed_service.compare_offers(
            offer_ids=offer_ids,
            priority_weights=None,
            target_location=None
        ))

        print("✓ Service executed successfully (no TypeError)")
        print(f"\nResult:")
        print(f"  - Compared {len(result['offers'])} offers")
        print(f"  - Best match: {result['best_match'][:8]}...")
        print(f"  - Status: ✅ FIXED")

        return True

    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


def main():
    success = test_exact_scenario()

    print("\n" + "=" * 70)
    print("Summary")
    print("=" * 70)

    if success:
        print("✅ Successfully reproduced and fixed the Sentry error!")
        print("\nThe fix:")
        print("  Add 'priority_weights' parameter to compare_offers() method")
        print("  in OfferComparisonService")
        print("\nChanged from:")
        print("  async def compare_offers(self, offer_ids, target_location=None)")
        print("\nChanged to:")
        print("  async def compare_offers(self, offer_ids, priority_weights=None,")
        print("                           target_location=None)")
        return 0
    else:
        print("❌ Test failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
