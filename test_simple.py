"""Simple test to verify the get_best_practices method exists and works."""

import sys
import asyncio


async def test_service():
    """Test the service directly."""
    sys.path.insert(0, "/workspace")
    
    from services.linkedin_optimizer_service import LinkedInOptimizerService
    
    print("Creating LinkedInOptimizerService instance...")
    service = LinkedInOptimizerService()
    
    # Test 1: Check method exists
    print("\n1. Checking if get_best_practices method exists...")
    assert hasattr(service, "get_best_practices"), "Method get_best_practices not found!"
    print("   ✓ Method exists")
    
    # Test 2: Call method with no section
    print("\n2. Testing get_best_practices() with no section...")
    result = await service.get_best_practices(section=None)
    assert result["success"] is True, "Expected success=True"
    assert "all_sections" in result, "Expected 'all_sections' in result"
    assert "headline" in result["all_sections"], "Expected 'headline' in sections"
    print(f"   ✓ Returned {len(result['all_sections'])} sections")
    
    # Test 3: Call method with headline section
    print("\n3. Testing get_best_practices(section='headline')...")
    result = await service.get_best_practices(section="headline")
    assert result["success"] is True, "Expected success=True"
    assert result["section"] == "headline", "Expected section='headline'"
    assert "data" in result, "Expected 'data' in result"
    assert "tips" in result["data"], "Expected 'tips' in data"
    print(f"   ✓ Returned {len(result['data']['tips'])} tips for headline")
    
    # Test 4: Call method with about section
    print("\n4. Testing get_best_practices(section='about')...")
    result = await service.get_best_practices(section="about")
    assert result["success"] is True
    assert result["section"] == "about"
    print(f"   ✓ Returned {len(result['data']['tips'])} tips for about section")
    
    # Test 5: Test invalid section
    print("\n5. Testing get_best_practices(section='invalid')...")
    result = await service.get_best_practices(section="invalid")
    assert result["success"] is False, "Expected success=False for invalid section"
    assert "error" in result, "Expected 'error' in result"
    print("   ✓ Correctly handled invalid section")
    
    print("\n" + "="*60)
    print("ALL TESTS PASSED! ✓")
    print("="*60)
    print("\nThe AttributeError has been fixed:")
    print("- LinkedInOptimizerService.get_best_practices() method now exists")
    print("- Method accepts optional 'section' parameter")
    print("- Returns proper data structure with best practices")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(test_service())
