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
    # SECURITY: Verify project exists AND belongs to the organization
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
- Added detailed comment explaining the security concern

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

## Advice for @markstory

Hey Mark! Great work on fixing the organization_id string comparison bug in ae9d7c01c30. While reviewing this endpoint, I noticed a related security issue with the project_id validation.

### Key Takeaways for Future Work:

1. **Always scope by organization:** Whenever you query a resource using a user-supplied ID, always include `organization_id` in the filter:
   ```python
   # ❌ Vulnerable
   Project.objects.filter(id=project_id).exists()
   
   # ✅ Secure
   Project.objects.filter(id=project_id, organization_id=org_id).exists()
   ```

2. **Don't use `self.get_projects()` when you can:** The endpoint has `self.get_projects()` available which already validates permissions, but since you're getting `project_id` from request data rather than query params, the manual validation is fine—just needs the org scope.

3. **IDOR checklist:** When writing endpoints that accept resource IDs:
   - [ ] Does the resource belong to the user's organization?
   - [ ] Does the user have the right permissions for this resource?
   - [ ] Could a malicious user guess/enumerate IDs from other orgs?

4. **Test for authorization failures:** When adding tests, always include at least one test that tries to access a resource from a different organization. This catches these bugs early.

The pattern you established with the organization_id string comparison was great—this just extends that security thinking to the project relationship as well!

## Test the Fix

Run the test suite:

```bash
pytest tests/sentry/api/endpoints/test_prompts_activity.py -xvs --reuse-db
```

The new test `test_project_from_different_organization` should pass, confirming the vulnerability is fixed.
