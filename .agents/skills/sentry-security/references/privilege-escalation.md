# Privilege Escalation Patterns

## Contents

- Role hierarchy enforcement
- Team role manipulation
- Superuser/staff checks

## Role Hierarchy

Sentry's organization roles from lowest to highest:

```
member → admin → manager → owner
```

Team roles:

```
contributor → admin
```

**Rule:** A user can only modify roles at or below their own level.

### Real vulnerability: Role downgrade by low-privilege users (PR #98213, #108288)

Contributors could downgrade org admins' team roles. Low-privilege members could downgrade other members' roles.

**Pattern to check:** Any endpoint that modifies a user's role must verify:

1. The requesting user's role is >= the target user's current role
2. The requesting user's role is >= the new role being set

```python
# WRONG: No role comparison
def update_member_role(self, request, member):
    member.role = request.data["role"]
    member.save()

# RIGHT: Verify requesting user has sufficient role
def update_member_role(self, request, member):
    new_role = request.data["role"]
    requesting_member = OrganizationMember.objects.get(
        user_id=request.user.id, organization_id=member.organization_id
    )
    # Can't set a role higher than your own
    if roles.get(new_role).priority > roles.get(requesting_member.role).priority:
        raise PermissionDenied()
    # Can't modify someone with a higher role than yours
    if roles.get(member.role).priority > roles.get(requesting_member.role).priority:
        raise PermissionDenied()
    member.role = new_role
    member.save()
```

## Superuser vs Staff Checks

### Real vulnerability: Superuser check instead of active staff (PR #105140)

Replay endpoints checked for `is_superuser` instead of `is_active_staff()`, which doesn't verify the superuser session is active.

**Correct patterns:**

```python
from sentry.auth.superuser import is_active_superuser
from sentry.auth.staff import is_active_staff

# WRONG: Checks the flag, not the active session
if request.user.is_superuser:
    ...

# RIGHT: Checks active superuser session
if is_active_superuser(request):
    ...

# RIGHT: Checks active staff session
if is_active_staff(request):
    ...
```

## Superuser Privilege Management

### Real vulnerability: No org membership check for privilege changes (PR #106877)

Staff could change superuser/staff privileges without verifying the target user was a member of the default org.

**Pattern to check:** Privilege escalation operations (granting superuser, staff) must verify org membership and other preconditions.

## Checklist

```
□ Role modification compares requesting user's role to target's current role
□ Role modification compares requesting user's role to the new role being set
□ Superuser checks use is_active_superuser(request), not request.user.is_superuser
□ Staff checks use is_active_staff(request)
□ Privilege changes verify org membership preconditions
□ Team role changes respect org-level role hierarchy
```
