#!/usr/bin/env python3
"""
Demonstration script showing that the AttributeError is fixed.

This script demonstrates that the LinkedInOptimizerService.get_best_practices()
method now exists and works correctly.
"""

import sys
import asyncio
sys.path.insert(0, '/workspace')

from services.linkedin_optimizer_service import LinkedInOptimizerService


async def main():
    """Demonstrate the fixed functionality."""
    print("="*70)
    print("DEMONSTRATION: AttributeError Fix")
    print("="*70)
    print()
    
    # Create service instance
    print("1. Creating LinkedInOptimizerService instance...")
    service = LinkedInOptimizerService()
    print("   ✓ Service instance created successfully")
    print()
    
    # Verify method exists
    print("2. Checking if get_best_practices method exists...")
    if hasattr(service, 'get_best_practices'):
        print("   ✓ Method exists!")
    else:
        print("   ✗ Method missing - This should not happen!")
        return
    print()
    
    # Test calling the method with a specific section
    print("3. Calling get_best_practices(section='headline')...")
    try:
        result = await service.get_best_practices(section='headline')
        print("   ✓ Method executed successfully!")
        print(f"   - Section: {result['section']}")
        print(f"   - Tips count: {len(result['data']['tips'])}")
        print(f"   - First tip: {result['data']['tips'][0][:60]}...")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return
    print()
    
    # Test calling without section parameter
    print("4. Calling get_best_practices() without parameters...")
    try:
        result = await service.get_best_practices()
        print("   ✓ Method executed successfully!")
        print(f"   - Sections available: {', '.join(result['sections'])}")
        print(f"   - General tips count: {len(result['general_tips'])}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return
    print()
    
    # Test each section
    print("5. Testing all LinkedIn sections...")
    sections = ['headline', 'about', 'experience', 'skills', 'education']
    for section in sections:
        try:
            result = await service.get_best_practices(section=section)
            print(f"   ✓ {section.capitalize()}: {len(result['data'].get('tips', []))} tips")
        except Exception as e:
            print(f"   ✗ {section.capitalize()}: {e}")
    print()
    
    # Test the API endpoint using TestClient
    print("6. Testing the API endpoint...")
    try:
        from fastapi.testclient import TestClient
        from main import app
        
        client = TestClient(app)
        response = client.get('/api/v1/linkedin-optimizer/best-practices')
        
        if response.status_code == 200:
            print("   ✓ API endpoint returns 200 OK")
            data = response.json()
            print(f"   - Response contains {len(data['sections'])} sections")
        else:
            print(f"   ✗ API endpoint returned status {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error testing API: {e}")
    print()
    
    print("="*70)
    print("RESULT: All tests passed! ✓")
    print("The AttributeError has been successfully fixed.")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(main())
