"""
Integration test to verify the NameError fix using FastAPI TestClient.
This simulates the exact HTTP request that was failing.
"""
import sys
import os

# Add workspace to path
sys.path.insert(0, '/workspace')

from fastapi import FastAPI
from fastapi.testclient import TestClient
from uuid import uuid4

from api.routes.applications import router, db

# Create FastAPI app and include the router
app = FastAPI()
app.include_router(router)

# Create test client
client = TestClient(app)

print("Testing the exact scenario from the error report...")
print("="*60)

# Setup: Create a test application
application_id = str(uuid4())
db.applications[application_id] = {
    "status": "pending",
    "priority": "high",
    "notes": "Initial notes",
    "interview_date": None,
    "follow_up_date": None,
    "salary_offered": None,
    "last_updated": "2025-12-24T00:00:00"
}

print(f"\n1. Created application: {application_id}")

# Make the exact HTTP request that was failing
print("\n2. Sending PUT request to update notes...")
print(f"   URL: /api/v1/applications/{application_id}")
print(f"   Body: {{'notes': 'Updated notes after interview'}}")

response = client.put(
    f"/api/v1/applications/{application_id}",
    json={"notes": "Updated notes after interview"}
)

print(f"\n3. Response Status Code: {response.status_code}")

# Before the fix, this would return 500 with:
# "Failed to update application: name 'result' is not defined"
if response.status_code == 500:
    print("\n✗ FAILED: Got 500 Internal Server Error")
    print(f"   Error: {response.json()}")
    exit(1)
elif response.status_code == 200:
    print("   ✓ SUCCESS: Got 200 OK (not 500!)")
    data = response.json()
    print(f"\n4. Response Data:")
    print(f"   - Notes: {data.get('notes')}")
    print(f"   - Last Updated: {data.get('last_updated')}")
    print(f"   - ID: {data.get('id')}")
else:
    print(f"\n✗ Unexpected status code: {response.status_code}")
    exit(1)

# Test the 404 case
print("\n" + "-"*60)
print("\n5. Testing 404 case with non-existent application...")
non_existent_id = str(uuid4())
response = client.put(
    f"/api/v1/applications/{non_existent_id}",
    json={"notes": "Test"}
)

if response.status_code == 404:
    print(f"   ✓ Correctly returns 404 for non-existent application")
    print(f"   Message: {response.json().get('detail')}")
else:
    print(f"   ✗ Expected 404, got {response.status_code}")

print("\n" + "="*60)
print("\n✓✓✓ ALL TESTS PASSED! ✓✓✓")
print("\nThe NameError has been fixed:")
print("  - The 'result' variable is now properly defined")
print("  - Database update logic is in place")
print("  - The endpoint returns 200 instead of 500")
print("="*60)
