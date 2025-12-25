"""Test for Offer Comparison API"""
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from api.routes.offer_comparison import router


# Create a test app
app = FastAPI()
app.include_router(router)
client = TestClient(app)


def test_list_offers():
    """Test listing offers endpoint"""
    response = client.get("/api/v1/offer-comparison/offers")
    assert response.status_code == 200
    
    data = response.json()
    assert "success" in data
    assert data["success"] is True
    assert "data" in data
    assert "offers" in data["data"]
    assert "total" in data["data"]
    assert "limit" in data["data"]
    

def test_list_offers_with_limit():
    """Test listing offers with custom limit"""
    response = client.get("/api/v1/offer-comparison/offers?limit=10")
    assert response.status_code == 200
    
    data = response.json()
    assert data["data"]["limit"] == 10


def test_list_offers_invalid_limit():
    """Test listing offers with invalid limit"""
    # Test limit > 100
    response = client.get("/api/v1/offer-comparison/offers?limit=150")
    assert response.status_code == 422
    
    # Test limit < 1
    response = client.get("/api/v1/offer-comparison/offers?limit=0")
    assert response.status_code == 422


def test_create_and_get_offer():
    """Test creating and retrieving an offer"""
    # Create offer
    offer_data = {
        "company": "Tech Corp",
        "position": "Senior Developer",
        "salary": 120000,
        "benefits": "Health insurance, 401k"
    }
    
    create_response = client.post(
        "/api/v1/offer-comparison/offers",
        json=offer_data
    )
    assert create_response.status_code == 200
    
    created_data = create_response.json()
    assert created_data["success"] is True
    offer_id = created_data["data"]["id"]
    
    # Get the created offer
    get_response = client.get(f"/api/v1/offer-comparison/offers/{offer_id}")
    assert get_response.status_code == 200
    
    retrieved_data = get_response.json()
    assert retrieved_data["success"] is True
    assert retrieved_data["data"]["company"] == "Tech Corp"


def test_get_nonexistent_offer():
    """Test getting an offer that doesn't exist"""
    response = client.get("/api/v1/offer-comparison/offers/99999")
    assert response.status_code == 404


def test_update_offer():
    """Test updating an offer"""
    # First create an offer
    offer_data = {
        "company": "Startup Inc",
        "position": "Developer",
        "salary": 100000
    }
    
    create_response = client.post(
        "/api/v1/offer-comparison/offers",
        json=offer_data
    )
    offer_id = create_response.json()["data"]["id"]
    
    # Update the offer
    update_data = {
        "salary": 110000
    }
    
    update_response = client.put(
        f"/api/v1/offer-comparison/offers/{offer_id}",
        json=update_data
    )
    assert update_response.status_code == 200
    
    updated_data = update_response.json()
    assert updated_data["data"]["salary"] == 110000


def test_delete_offer():
    """Test deleting an offer"""
    # First create an offer
    offer_data = {
        "company": "Company X",
        "position": "Engineer"
    }
    
    create_response = client.post(
        "/api/v1/offer-comparison/offers",
        json=offer_data
    )
    offer_id = create_response.json()["data"]["id"]
    
    # Delete the offer
    delete_response = client.delete(
        f"/api/v1/offer-comparison/offers/{offer_id}"
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["success"] is True
    
    # Verify it's gone
    get_response = client.get(f"/api/v1/offer-comparison/offers/{offer_id}")
    assert get_response.status_code == 404


def test_compare_offers():
    """Test comparing multiple offers"""
    # Create two offers
    offer1_data = {"company": "Company A", "salary": 100000}
    offer2_data = {"company": "Company B", "salary": 110000}
    
    response1 = client.post("/api/v1/offer-comparison/offers", json=offer1_data)
    response2 = client.post("/api/v1/offer-comparison/offers", json=offer2_data)
    
    offer1_id = response1.json()["data"]["id"]
    offer2_id = response2.json()["data"]["id"]
    
    # Compare offers
    compare_response = client.post(
        "/api/v1/offer-comparison/offers/compare",
        json=[offer1_id, offer2_id]
    )
    
    assert compare_response.status_code == 200
    compare_data = compare_response.json()
    assert compare_data["success"] is True
    assert compare_data["data"]["comparison_count"] == 2


def test_compare_offers_insufficient():
    """Test comparing with insufficient offers"""
    response = client.post(
        "/api/v1/offer-comparison/offers/compare",
        json=[1]
    )
    assert response.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
