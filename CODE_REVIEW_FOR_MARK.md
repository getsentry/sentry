# Code Review: Prompts Activity IDOR Fix

## Hey @markstory! 👋

I found and fixed a security vulnerability in the prompts activity endpoint you've been working on. Don't worry—these IDOR bugs are subtle and easy to miss! Here's what happened and some advice for the future.

---

## 🐛 The Bug

**Location:** `src/sentry/api/endpoints/prompts_activity.py` (lines 94-101)

**What happened:** The endpoint checked if a project exists, but didn't verify it belongs to the user's organization.

### Before (Vulnerable):

```python
if "project_id" in required_fields:
    if not Project.objects.filter(id=fields["project_id"]).exists():
        return Response({"detail": "Project no longer exists"}, status=400)
```

### After (Secure):

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

**Impact:** A malicious user could:

1. Guess/enumerate project IDs from other organizations
2. Send a request with their org ID but another org's project ID
3. Successfully create prompt activity for projects they shouldn't access

---

## 💡 Lessons & Best Practices

### 1. **Always Scope Queries by Organization**

This is the #1 security rule for multi-tenant apps like Sentry:

```python
# ❌ VULNERABLE - Only checks existence
Model.objects.filter(id=user_supplied_id).exists()

# ✅ SECURE - Scopes to current organization
Model.objects.filter(
    id=user_supplied_id,
    organization_id=current_org_id
).exists()
```

### 2. **Use Available Authorization Helpers**

For endpoints, `self.get_projects()` is your friend:

```python
# Instead of manual validation:
projects = Project.objects.filter(id__in=project_ids, organization_id=org.id)

# Use the built-in method (when appropriate):
projects = self.get_projects(
    request=request,
    organization=organization,
    project_ids=request.data.get("project_id")
)
```

(Note: In your case, manual validation was fine since you're handling single IDs from request body—just needed the org scope!)

### 3. **Security Testing Checklist**

When writing tests for endpoints that accept resource IDs, always include:

- ✅ Happy path (valid resource, correct org)
- ✅ Resource doesn't exist
- ✅ **Resource exists but belongs to DIFFERENT org** ← This catches IDOR bugs!
- ✅ Missing required fields
- ✅ Invalid permissions

### 4. **Watch for This Pattern Everywhere**

Any time you see `request.data.get("some_id")` or `request.GET.get("some_id")`, ask:

- Does this resource have an organization relationship?
- Am I verifying that relationship in my query?

---

## 🎯 What I Changed

### 1. Fixed the vulnerability

- **File:** `src/sentry/api/endpoints/prompts_activity.py`
- **Change:** Added `organization_id=request.organization.id` to the project filter
- **Added:** Detailed security comment explaining why (so future devs understand)

### 2. Added regression test

- **File:** `tests/sentry/api/endpoints/test_prompts_activity.py`
- **New test:** `test_project_from_different_organization()`
- **Purpose:** Ensures users can't access projects from other orgs

### 3. Updated existing test

- **Test:** `test_invalid_project()`
- **Change:** Updated to expect new error message

---

## 🤔 Why This Happened

You actually DID fix a security issue in this same file in commit ae9d7c01c30—the organization_id string comparison bug! That shows you're thinking about security.

The project_id validation was just one level deeper and easier to miss. The original code was checking "does project exist?" but not "does this user have access to this project?"

---

## 📚 Further Reading

- See `AGENTS.md` in the repo for more on IDOR prevention
- Search for "OWASP IDOR" for general info on this vulnerability class
- The fix follows Sentry's existing patterns (check other endpoints with `organization_id` filters)

---

## ✅ Validation

The fix includes:

- Clear security comments in the code
- Regression test that will fail if someone removes the org scope
- Updated error message that's more accurate

---

## Questions?

This is a really common pattern to miss, so don't sweat it! The important thing is having tests that catch it. Going forward, when you see endpoints that accept project/org IDs from users, just remember: **never trust, always verify, always scope!**

Let me know if you have any questions about the fix or want to discuss other security patterns in the codebase.

Cheers! 🍻
