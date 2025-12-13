# IDOR Vulnerability Fix in Prompts Activity Endpoint

## Bug Found
**Author of original code:** Mark Story (commit ae9d7c01c30 and related)  
**Severity:** High - Security vulnerability (IDOR - Indirect Object Reference)

## Problem
The `/api/0/organizations/{org}/prompts-activity/` endpoint had an IDOR vulnerability where a user could dismiss prompts for projects belonging to OTHER organizations.

### Vulnerable Code (Before Fix)
```python
if "project_id" in required_fields:
    if not Project.objects.filter(id=fields["project_id"]).exists():
        return Response({"detail": "Project no longer exists"}, status=400)
```

**Issue:** The code only checked if the project EXISTS in the database, but didn't verify that the project belongs to the user's organization. This allowed a malicious user to:
1. Discover project IDs from other organizations
2. Submit requests with their own organization but another org's project ID
3. Successfully create prompt activity records for projects they shouldn't have access to

## Fix
Added proper authorization check by scoping the project query to the current organization:

```python
if "project_id" in required_fields:
    # Verify project exists and belongs to the organization
    if not Project.objects.filter(
        id=fields["project_id"], organization_id=request.organization.id
    ).exists():
        return Response(
            {"detail": "Project does not belong to this organization"}, status=400
        )
```

## Changes Made

### 1. Fixed the security vulnerability
**File:** `src/sentry/api/endpoints/prompts_activity.py`
- Line 95-101: Added `organization_id=request.organization.id` filter to project existence check
- Changed error message to be more accurate: "Project does not belong to this organization"

### 2. Added test to prevent regression
**File:** `tests/sentry/api/endpoints/test_prompts_activity.py`
- Added `test_project_from_different_organization()` to verify that users cannot dismiss prompts for projects in other organizations
- Updated `test_invalid_project()` to check for the new error message

## Why This Matters
This follows the security guidelines in AGENTS.md:

> **Core Principle: Always Scope Queries by Organization/Project**
> 
> When querying resources, ALWAYS include `organization_id` and/or `project_id` in your query filters. Never trust user-supplied IDs alone.

Mark Story fixed a similar issue with organization_id string comparison in the same file, but missed this project validation issue. This is a common pattern to watch for throughout the codebase.

## Test the Fix
Run the test suite:
```bash
pytest tests/sentry/api/endpoints/test_prompts_activity.py -xvs --reuse-db
```

The new test `test_project_from_different_organization` should pass, confirming the vulnerability is fixed.
