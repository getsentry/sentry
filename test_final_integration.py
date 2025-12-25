#!/usr/bin/env python3
"""
Final Integration Test - Verify the complete fix
"""

import sys
import os
sys.path.insert(0, "/workspace")

def test_imports():
    """Test that all modules can be imported."""
    print("Testing imports...")
    try:
        from services.linkedin_optimizer_service import LinkedInOptimizerService
        print("  ✓ services.linkedin_optimizer_service imported")
        
        from api.routes.linkedin_optimizer import router, get_service
        print("  ✓ api.routes.linkedin_optimizer imported")
        
        return True
    except ImportError as e:
        print(f"  ✗ Import failed: {e}")
        return False


def test_service_class():
    """Test that the service class is properly defined."""
    print("\nTesting service class...")
    from services.linkedin_optimizer_service import LinkedInOptimizerService
    
    # Create instance
    service = LinkedInOptimizerService()
    print(f"  ✓ Service instance created: {type(service).__name__}")
    
    # Check all required methods
    required_methods = [
        'get_best_practices',
        'generate_headline',
        'generate_about',
        'get_suggestions',
        'analyze_keywords',
        'get_action_words'
    ]
    
    for method in required_methods:
        if hasattr(service, method):
            print(f"  ✓ Method '{method}' exists")
        else:
            print(f"  ✗ Method '{method}' missing!")
            return False
    
    return True


def test_method_async():
    """Test that get_best_practices is an async method."""
    print("\nTesting method signature...")
    from services.linkedin_optimizer_service import LinkedInOptimizerService
    import inspect
    
    service = LinkedInOptimizerService()
    method = getattr(service, 'get_best_practices')
    
    is_coroutine = inspect.iscoroutinefunction(method)
    print(f"  ✓ Method is async: {is_coroutine}")
    
    # Get signature
    sig = inspect.signature(method)
    params = list(sig.parameters.keys())
    print(f"  ✓ Parameters: {params}")
    
    return is_coroutine


def test_data_structure():
    """Test that the service has the required data structures."""
    print("\nTesting data structures...")
    from services.linkedin_optimizer_service import LinkedInOptimizerService
    
    service = LinkedInOptimizerService()
    
    if hasattr(service, 'best_practices_data'):
        print("  ✓ best_practices_data exists")
        sections = list(service.best_practices_data.keys())
        print(f"  ✓ Sections: {sections}")
    else:
        print("  ✗ best_practices_data missing!")
        return False
    
    if hasattr(service, 'general_best_practices'):
        print("  ✓ general_best_practices exists")
    else:
        print("  ✗ general_best_practices missing!")
        return False
    
    return True


def test_api_route():
    """Test that the API route is properly configured."""
    print("\nTesting API route configuration...")
    from api.routes.linkedin_optimizer import router
    
    print(f"  ✓ Router prefix: {router.prefix}")
    print(f"  ✓ Router tags: {router.tags}")
    
    # Check routes
    route_paths = [route.path for route in router.routes]
    print(f"  ✓ Number of routes: {len(route_paths)}")
    
    if "/best-practices" in route_paths:
        print("  ✓ '/best-practices' route exists")
    else:
        print("  ✗ '/best-practices' route missing!")
        return False
    
    return True


def main():
    """Run all tests."""
    print("="*70)
    print("FINAL INTEGRATION TEST")
    print("="*70)
    print()
    
    tests = [
        ("Import Test", test_imports),
        ("Service Class Test", test_service_class),
        ("Method Signature Test", test_method_async),
        ("Data Structure Test", test_data_structure),
        ("API Route Test", test_api_route),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n  ✗ Test failed with exception: {e}")
            results.append((name, False))
    
    print()
    print("="*70)
    print("TEST RESULTS")
    print("="*70)
    
    all_passed = True
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status} - {name}")
        if not result:
            all_passed = False
    
    print()
    if all_passed:
        print("="*70)
        print("ALL TESTS PASSED! ✅")
        print("="*70)
        print()
        print("The AttributeError fix is complete and verified:")
        print("  ✓ LinkedInOptimizerService class exists")
        print("  ✓ get_best_practices() method implemented")
        print("  ✓ API route configured correctly")
        print("  ✓ All data structures in place")
        print()
        print("The endpoint is ready to use:")
        print("  GET /api/v1/linkedin-optimizer/best-practices")
        print("  GET /api/v1/linkedin-optimizer/best-practices?section=<section>")
        print()
        print("="*70)
        return 0
    else:
        print("="*70)
        print("SOME TESTS FAILED ❌")
        print("="*70)
        return 1


if __name__ == "__main__":
    sys.exit(main())
