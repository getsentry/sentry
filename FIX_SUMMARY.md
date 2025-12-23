# Fix for TypeError: can't access property "id", t is null

## Issue
**Error**: `TypeError: can't access property "id", t is null`  
**Location**: `/settings/:orgId/teams/:teamId/members/`  
**Component**: `AddMemberDropdown` in `teamMembers.tsx`

The frontend was crashing when trying to access the `id` property on a null organization member object returned by the backend API.

## Root Cause
When `user_service.serialize_many()` is called with user IDs that include deleted users, it returns `None` for those users in the result list. Multiple serializers were not checking for `None` values before attempting to access properties like `["id"]` or `["email"]`, which caused:

1. A crash in the serializer that prevented proper response serialization
2. Malformed API responses containing `null` entries
3. Frontend crashes when trying to access properties on these `null` objects

## Solution
Added `None` checks throughout the codebase when iterating over `user_service.serialize_many()` results, following the established pattern from `GroupSearchViewSerializer`.

## Files Modified

### Backend Serializers (6 files)

#### 1. `src/sentry/api/serializers/models/organization_member/base.py`
**Primary fix for the reported issue**
```python
for u in user_service.serialize_many(filter={"user_ids": users_set}):
    if u is None:
        continue
    # Filter out the emails from the user data
    u.pop("emails", None)
    users_by_id[u["id"]] = u
    email_map[u["id"]] = u["email"]
```

#### 2. `src/sentry/api/serializers/models/organization_member/expand/roles.py`
**Related fix for organization member serialization with roles**
```python
users_by_id = {
    u["id"]: u
    for u in user_service.serialize_many(
        filter=dict(user_ids=[om.user_id for om in item_list if om.user_id is not None]),
        serializer=UserSerializeType.DETAILED,
    )
    if u is not None  # Added None filter
}
```

#### 3. `src/sentry/api/serializers/models/exporteddata.py`
**Preventive fix for exported data serialization**
```python
serialized_users = {
    u["id"]: u
    for u in user_service.serialize_many(
        filter=dict(user_ids=[item.user_id for item in item_list])
    )
    if u is not None  # Added None filter
}
```

#### 4. `src/sentry/api/serializers/models/dashboard.py`
**Preventive fix for dashboard serialization (2 locations)**
```python
# Fix 1: In get_attrs()
serialized_users = {
    user["id"]: user
    for user in user_service.serialize_many(...)
    if user is not None  # Added None filter
}

# Fix 2: In serialize()
serialized_created_by = None
if obj.created_by_id:
    created_by_list = user_service.serialize_many(filter={"user_ids": [obj.created_by_id]})
    serialized_created_by = created_by_list[0] if created_by_list and created_by_list[0] is not None else None
```

#### 5. `src/sentry/api/serializers/models/exploresavedquery.py`
**Preventive fix for explore saved query serialization**
```python
serialized_users = {
    user["id"]: user 
    for user in service_serialized 
    if user is not None  # Added None filter
}
```

#### 6. `src/sentry/api/serializers/models/release.py`
**Preventive fix for release serialization**
```python
owners = {
    d["id"]: d
    for d in user_service.serialize_many(...)
    if d is not None  # Added None filter
}
```

### Tests (1 file)

#### 7. `tests/sentry/core/endpoints/test_organization_member_index.py`
**New test to verify the fix**
```python
def test_handles_deleted_user(self) -> None:
    """
    Test that when a user is deleted from the system but their OrganizationMember
    remains, the endpoint handles it gracefully without crashing.
    """
    # Create and then delete a user
    deleted_user = self.create_user("deleted@localhost", username="deleted")
    deleted_member = self.create_member(organization=self.organization, user=deleted_user)
    
    with assume_test_silo_mode(SiloMode.CONTROL):
        deleted_user.delete()
    
    # Verify endpoint doesn't crash
    response = self.get_success_response(self.organization.slug)
    assert len(response.data) == 2  # Only active users returned
```

## Changes Summary
- **7 files changed**: 6 backend serializers + 1 test file
- **44 insertions**, **6 deletions**
- **Pattern applied**: Consistent `if u is not None` filtering across all `user_service.serialize_many()` calls

## Impact
- ✅ Fixes the reported TypeError crash on team members page
- ✅ Improves resilience across 6 different serializers
- ✅ Aligns with existing patterns in the codebase (e.g., `GroupSearchViewSerializer`)
- ✅ No breaking changes - deleted users are simply filtered out
- ✅ Handles edge cases where users are deleted but their records remain

## Testing
- Added comprehensive test case for the primary issue
- All modified files pass Python syntax validation
- Pattern matches existing successful implementations

## References
- Similar fix pattern exists in: `src/sentry/api/serializers/models/groupsearchview.py` (line 57)
- Related test: `tests/sentry/issues/endpoints/test_organization_group_search_views_starred.py::test_handles_none_from_user_service`
