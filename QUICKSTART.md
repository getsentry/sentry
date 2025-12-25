# Quick Start Guide - Recruiter CRM API

## Fixed Issue
✅ **TypeError with 'specializations' parameter is now FIXED**

The service method now properly accepts the `specializations` parameter that was causing the TypeError.

## Installation

```bash
# Install dependencies
pip install -r requirements-recruiter-crm.txt
```

## Running the Application

```bash
# Option 1: Run with Python
python3 main.py

# Option 2: Run with Uvicorn (recommended for development)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base:** http://localhost:8000
- **Interactive Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## Verification

### Quick Verification
```bash
# Run the verification script
python3 verify_fix.py
```

### Run Test Suite
```bash
# Run all tests
pytest test_recruiter_crm.py -v

# Or run with Python directly (avoids pytest config conflicts)
python3 test_recruiter_crm.py
```

## Example API Usage

### Create a Recruiter (with specializations)
```bash
curl -X POST "http://localhost:8000/api/v1/recruiter-crm/recruiters" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@techrecruit.com",
    "company": "TechRecruit Inc",
    "recruiter_type": "internal",
    "specializations": ["Python", "DevOps", "Cloud Engineering"]
  }'
```

### Get All Recruiters
```bash
curl http://localhost:8000/api/v1/recruiter-crm/recruiters
```

### Get Specific Recruiter
```bash
curl http://localhost:8000/api/v1/recruiter-crm/recruiters/{id}
```

## Project Structure

```
/workspace/
├── api/
│   └── routes/
│       └── recruiter_crm.py      # API endpoints
├── services/
│   └── recruiter_crm_service.py  # Business logic (FIXED)
├── models/
│   └── recruiter.py              # Data models
├── main.py                       # FastAPI application
├── test_recruiter_crm.py         # Test suite
├── verify_fix.py                 # Verification script
├── requirements-recruiter-crm.txt # Dependencies
├── BUG_FIX_SUMMARY.md            # Detailed fix documentation
└── RECRUITER_CRM_FIX.md          # Complete guide
```

## Key Changes

The fix was simple but critical:

1. **Added missing parameter** to `RecruiterCRMService.add_recruiter()`:
   ```python
   specializations: Optional[list[str]] = None
   ```

2. **Handle the parameter** in the method body:
   ```python
   "specializations": specializations or []
   ```

That's it! The API now works correctly with the specializations field.

## Health Check

```bash
curl http://localhost:8000/health
# Response: {"status":"healthy"}
```

## API Documentation

Once the server is running, visit:
- http://localhost:8000/docs for Swagger UI
- http://localhost:8000/redoc for ReDoc

## Support

For issues or questions, refer to:
- `BUG_FIX_SUMMARY.md` - Technical details of the fix
- `RECRUITER_CRM_FIX.md` - Complete documentation
