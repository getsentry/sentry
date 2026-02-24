# DRF Permissions - Context for Investigation

Background on how DRF handles permissions. Use this to understand what you're seeing, not as patterns to match.

## How DRF Permission Flow Works

```
Request → permission_classes.has_permission() → View method → get_object() → has_object_permission()
```

### has_permission()

- Called on EVERY request
- Checked BEFORE the view method runs
- Good for "is user authenticated?" or "is user admin?"
- NOT good for "does user own this specific object?"

### has_object_permission()

- Only called when `self.get_object()` is called
- NOT called for list views (no specific object)
- This is where object-level checks can happen

**Critical**: If a view does `Model.objects.get(pk=pk)` directly instead of `self.get_object()`, the `has_object_permission()` is NEVER called.

## Things to Check When Investigating

### 1. What's in DEFAULT_PERMISSION_CLASSES?

```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [...]
}
```

This applies to ALL views unless overridden.

### 2. What does each permission class actually do?

Don't assume from the name. Read the class:

```python
# IsAuthenticated only checks login, not ownership
# DjangoModelPermissions checks model-level perms, not object-level
# Custom classes - read the implementation
```

### 3. How is data fetched?

```python
# Uses get_object() - permissions apply
instance = self.get_object()

# Direct query - permissions DON'T apply
instance = Model.objects.get(pk=pk)
```

### 4. What's in get_queryset()?

This determines what objects are even reachable:

```python
def get_queryset(self):
    return Model.objects.all()  # Everything
    return Model.objects.filter(owner=self.request.user)  # Scoped
```

## Serializer Considerations

Serializers control what fields are readable/writable:

```python
class Meta:
    fields = '__all__'  # What's included?
    read_only_fields = [...]  # What can't be set?
```

Key question: Can the client set the owner field, or is it server-controlled?
