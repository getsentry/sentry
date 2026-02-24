# Django ORM - Context for Investigation

How data access works in Django. Use this to understand query patterns you encounter.

## Where Scoping Can Happen

### Custom Managers

Projects may have managers that auto-filter:

```python
class TenantManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(tenant=get_current_tenant())

class Document(models.Model):
    objects = TenantManager()  # All queries auto-scoped
    unscoped = models.Manager()  # Escape hatch for admin
```

**Key**: If you see `Model.objects.all()`, check if `objects` is a custom manager.

### Middleware

Some projects set context that managers use:

```python
# Middleware might set thread-local tenant
_thread_locals.tenant = request.user.tenant

# Manager reads it
def get_queryset(self):
    return super().get_queryset().filter(tenant=_thread_locals.tenant)
```

## Query Patterns to Understand

### Direct Fetch

```python
# Fetches by ID only - no user scoping
Document.objects.get(pk=pk)

# Includes user in query - scoped
Document.objects.get(pk=pk, owner=request.user)
```

### Filtered Fetch

```python
# Unscoped - returns everything matching
Document.objects.filter(status='active')

# Scoped - only user's documents
Document.objects.filter(status='active', owner=request.user)
```

### Related Objects

```python
# If document is scoped but comments aren't...
document = Document.objects.get(pk=pk, owner=request.user)
comments = document.comments.all()  # Are these comments scoped?
```

## Questions When Investigating Queries

1. Is this using a custom manager that auto-scopes?
2. Is there middleware setting context the manager uses?
3. Does the query include the current user/tenant?
4. For related queries, is the parent object properly scoped?
