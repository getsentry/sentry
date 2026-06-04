# Serializer Security Patterns

## Contents

- ActorField vs OwnerActorField
- Foreign key fields in serializers
- Request body ID validation

## ActorField vs OwnerActorField

`ActorField` accepts any user or team ID without validating the requesting user's relationship to that actor. `OwnerActorField` additionally checks that the requesting user is a member of the target team.

**Location:** `src/sentry/api/fields/actor.py`

### When to use which

Default to `OwnerActorField` for any write-op field accepting a team or user reference (assignment, ownership, delegation). Originally PR #106074.

One known exception: `GroupValidator.assignedTo` uses `ActorField`. Issue assignment is a label — it doesn't grant access, and project-access is validated separately in `validate_assignedTo`. Don't expand this exception without explicit review.

### Real vulnerability: ActorField for ownership (PR #106074)

**Vulnerable code:**

```python
class IssueAlertRuleSerializer(serializers.Serializer):
    owner = ActorField(required=False)  # BUG: Any team, no membership check
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
4. Otherwise → `ValidationError("You can only assign teams you are a member of")`

### Finding existing uses

```
grep -rn "ActorField" --include="*.py" src/sentry/api/
```

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
□ Owner/assignee fields use OwnerActorField (exception: issue assignment uses ActorField)
□ FK ID fields in request body are validated against the org
□ IDs that should be server-set are not exposed in the serializer
□ Serializer context includes organization for validation
```
