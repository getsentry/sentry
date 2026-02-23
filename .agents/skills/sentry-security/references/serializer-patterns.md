# Serializer Security Patterns

## Contents

- ActorField vs OwnerActorField
- Foreign key fields in serializers
- Request body ID validation

## ActorField vs OwnerActorField

`ActorField` accepts any user or team ID without validating the requesting user's relationship to that actor. `OwnerActorField` validates team membership before allowing assignment.

**Location:** `src/sentry/api/fields/actor.py`

### When to use which

| Field             | Validates Membership | Use For                           |
| ----------------- | -------------------- | --------------------------------- |
| `ActorField`      | No                   | Read-only display, filtering      |
| `OwnerActorField` | Yes                  | Owner assignment, assignee fields |

### Real vulnerability: ActorField for ownership (PR #106074)

**Vulnerable code:**

```python
class IssueAlertRuleSerializer(serializers.Serializer):
    owner = ActorField(required=False)  # BUG: Any actor, no membership check
```

**Fixed code:**

```python
class IssueAlertRuleSerializer(serializers.Serializer):
    owner = OwnerActorField(required=False)  # Validates team membership
```

### What OwnerActorField validates

1. If org has `allow_joinleave` flag → any team is allowed (user could join anyway)
2. If user has `team:admin` scope → any team is allowed
3. If user is a member of the target team → allowed
4. If user is a member of the current owner's team → allowed (can reassign from their team)
5. Otherwise → `ValidationError("You can only assign teams you are a member of")`

### What to look for

Any serializer field that accepts a team or user reference for **write operations** (assignment, ownership, delegation) should use `OwnerActorField`, not `ActorField`.

Search pattern:

```
grep -rn "ActorField" --include="*.py" src/sentry/api/
```

Flag any `ActorField()` used in a serializer for PUT/POST operations where the field sets an owner or assignee.

## Foreign Key IDs in Request Bodies

When a serializer accepts an ID that references another model, the serializer or view must validate that the referenced object belongs to the same organization.

### Pattern: Unvalidated FK reference

```python
class MySerializer(serializers.Serializer):
    related_id = serializers.IntegerField()

    # BUG: No validation that related_id belongs to same org
```

### Pattern: Validated FK reference

```python
class MySerializer(serializers.Serializer):
    related_id = serializers.IntegerField()

    def validate_related_id(self, value):
        organization = self.context["organization"]
        if not RelatedModel.objects.filter(
            id=value, organization_id=organization.id
        ).exists():
            raise serializers.ValidationError("Related object not found")
        return value
```

### Real vulnerability: conditionGroupId (PR #108156)

A serializer accepted `condition_group_id` from user input, allowing a user to inject conditions from another organization's workflow.

**Fix:** Remove the field from user input entirely. Set it server-side from the validated context.

## Checklist

```
□ Owner/assignee fields use OwnerActorField, not ActorField
□ FK ID fields in request body are validated against the org
□ IDs that should be server-set are not exposed in the serializer
□ Serializer context includes organization for validation
```
