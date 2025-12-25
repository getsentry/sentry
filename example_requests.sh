#!/bin/bash
# Example API calls for Recruiter CRM API

BASE_URL="http://localhost:8000"

echo "=========================================="
echo "Recruiter CRM API - Example Requests"
echo "=========================================="
echo ""

# Health check
echo "1. Health Check"
echo "   GET $BASE_URL/health"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo ""

# List all recruiters
echo "2. List All Recruiters (default pagination)"
echo "   GET $BASE_URL/api/v1/recruiter-crm/recruiters"
curl -s "$BASE_URL/api/v1/recruiter-crm/recruiters" | python3 -m json.tool
echo ""
echo ""

# List recruiters with filters
echo "3. List Recruiters with Filters"
echo "   GET $BASE_URL/api/v1/recruiter-crm/recruiters?status=active&recruiter_type=external&limit=10"
curl -s "$BASE_URL/api/v1/recruiter-crm/recruiters?status=active&recruiter_type=external&limit=10" | python3 -m json.tool
echo ""
echo ""

# Create a recruiter
echo "4. Create a Recruiter"
echo "   POST $BASE_URL/api/v1/recruiter-crm/recruiters"
curl -s -X POST "$BASE_URL/api/v1/recruiter-crm/recruiters" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@techrecruiting.com",
    "company": "TechRecruiting Inc",
    "phone": "+1-555-0123",
    "specialization": "Software Engineering",
    "status": "active",
    "recruiter_type": "external"
  }' | python3 -m json.tool
echo ""
echo ""

# Get a specific recruiter (will return 404 in this example)
echo "5. Get Specific Recruiter"
echo "   GET $BASE_URL/api/v1/recruiter-crm/recruiters/1"
curl -s "$BASE_URL/api/v1/recruiter-crm/recruiters/1" | python3 -m json.tool
echo ""
echo ""

# Update a recruiter (will return 404 in this example)
echo "6. Update Recruiter"
echo "   PUT $BASE_URL/api/v1/recruiter-crm/recruiters/1"
curl -s -X PUT "$BASE_URL/api/v1/recruiter-crm/recruiters/1" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe Updated",
    "status": "inactive"
  }' | python3 -m json.tool
echo ""
echo ""

# Delete a recruiter (will return 404 in this example)
echo "7. Delete Recruiter"
echo "   DELETE $BASE_URL/api/v1/recruiter-crm/recruiters/1"
curl -s -X DELETE "$BASE_URL/api/v1/recruiter-crm/recruiters/1" | python3 -m json.tool
echo ""
echo ""

# Test pagination
echo "8. Test Pagination"
echo "   GET $BASE_URL/api/v1/recruiter-crm/recruiters?limit=25&offset=0"
curl -s "$BASE_URL/api/v1/recruiter-crm/recruiters?limit=25&offset=0" | python3 -m json.tool
echo ""
echo ""

# Test invalid status (should return 422)
echo "9. Test Validation Error (invalid status)"
echo "   GET $BASE_URL/api/v1/recruiter-crm/recruiters?status=invalid"
curl -s "$BASE_URL/api/v1/recruiter-crm/recruiters?status=invalid" | python3 -m json.tool
echo ""
echo ""

# Test rate limiting headers
echo "10. Check Rate Limit Headers"
echo "   GET $BASE_URL/api/v1/recruiter-crm/recruiters -v (showing headers)"
curl -v "$BASE_URL/api/v1/recruiter-crm/recruiters" 2>&1 | grep -E "(X-RateLimit|X-Request-ID)"
echo ""
echo ""

echo "=========================================="
echo "All example requests completed!"
echo "=========================================="
