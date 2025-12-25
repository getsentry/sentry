# Deployment Checklist

## ✅ Fix Applied

The FastAPI route ordering issue has been fixed. Use this checklist to deploy the solution.

---

## Pre-Deployment Verification

### 1. Code Review
- [ ] Review `api/routes/jobs.py` - verify `/search` is before `/{job_id}`
- [ ] Check that comments explain the ordering requirement
- [ ] Ensure error handling is proper (404 for not found, not 501)

### 2. Local Testing
- [ ] Install dependencies: `pip install fastapi[all]`
- [ ] Run verification script: `python api/verify_fix.py`
- [ ] All 4 tests pass
- [ ] No 501 errors on `/search` endpoint

### 3. Test Suite
- [ ] Install pytest: `pip install pytest`
- [ ] Run tests: `pytest api/routes/test_jobs.py -v`
- [ ] All tests pass
- [ ] Route ordering test passes

---

## Deployment Steps

### 1. Apply Changes
```bash
# Copy the fixed file to your project
cp api/routes/jobs.py <your-project>/api/routes/jobs.py

# Or manually ensure route order is correct:
# 1. /search route defined first
# 2. /{job_id} route defined second
```

### 2. Update Imports (if needed)
```python
# Ensure these imports are present
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
```

### 3. Database Integration
Replace the placeholder logic with actual database queries:

```python
# In search_jobs()
results = db.query(Job).filter(
    Job.title.contains(query) if query else True,
    Job.location == location if location else True,
    Job.remote == remote if remote is not None else True
).all()

# In get_job()
job = db.query(Job).filter(Job.id == job_id).first()
if not job:
    raise HTTPException(404, detail=f"Job '{job_id}' not found")
return job
```

### 4. Run Deployment
```bash
# Standard deployment process
# e.g., Docker build, Kubernetes deploy, etc.
```

---

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-api.com/health
# Should return: {"status": "healthy"}
```

### 2. Search Endpoint Test
```bash
curl "https://your-api.com/api/v1/jobs/search?query=python&location=SF"
# Should return: 200 OK with search results
# Should NOT return: 501 Not Implemented
```

### 3. Job Detail Test
```bash
curl https://your-api.com/api/v1/jobs/some-job-id
# Should return: 200 OK with job details OR 404 Not Found
# Should NOT return: 501 Not Implemented
```

### 4. Verify Route Order
Check application logs to ensure routes are registered correctly:
```
INFO: Route /api/v1/jobs/search registered
INFO: Route /api/v1/jobs/{job_id} registered
```

---

## Monitoring

### Metrics to Watch
- [ ] 501 errors on `/search` (should be 0)
- [ ] 200 responses on `/search` (should increase)
- [ ] Search endpoint latency
- [ ] Job detail endpoint 404 rate (normal for invalid IDs)

### Alert Rules
```yaml
# Example alert rule
- alert: SearchEndpoint501Errors
  expr: http_requests_total{endpoint="/search", status="501"} > 0
  for: 5m
  annotations:
    summary: "Search endpoint returning 501 errors - route ordering bug may be back"
```

---

## Rollback Plan (if needed)

### If Issues Occur
1. Check route order in deployed code
2. Verify no conflicting middleware
3. Check FastAPI version compatibility
4. Review deployment logs

### Quick Rollback
```bash
# Revert to previous version
git revert <commit-hash>
# Deploy previous version
```

---

## Documentation Updates

### 1. API Documentation
- [ ] Update API docs to show `/search` endpoint
- [ ] Add examples of search queries
- [ ] Document query parameters

### 2. Developer Documentation
- [ ] Add note about route ordering importance
- [ ] Link to QUICK_REFERENCE.md for developers
- [ ] Add to coding standards/best practices

### 3. Changelog
```markdown
## [Version X.Y.Z] - 2025-12-25
### Fixed
- Fixed route ordering bug causing 501 errors on /jobs/search endpoint
- Search requests now correctly return job results instead of "not implemented" error
- Improved error handling with proper 404 responses for missing jobs
```

---

## Common Issues & Solutions

### Issue: Still Getting 501 Errors

**Possible Causes:**
1. Routes not in correct order
2. Cached code (old version still running)
3. Multiple route definitions conflict

**Solution:**
```python
# Verify order in your code:
# 1. /search should be BEFORE /{job_id}
# 2. No duplicate route definitions
# 3. Restart application to clear cache
```

### Issue: Tests Fail

**Check:**
1. FastAPI version (`pip show fastapi`)
2. Test dependencies installed
3. Database connectivity (if using real DB)

---

## Success Criteria

✅ **Deployment is successful when:**
- `/search` endpoint returns 200 OK
- Search results are returned correctly
- No 501 errors in logs
- Job detail endpoint still works for actual IDs
- All tests pass
- Monitoring shows no issues

---

## Additional Resources

- `api/README.md` - Full documentation
- `api/QUICK_REFERENCE.md` - Developer guide
- `api/SOLUTION.md` - Quick solution summary
- `api/INDEX.md` - Documentation index

---

**Status:** Ready for Deployment ✅

**Date:** December 25, 2025

**Approved by:** Development Team
