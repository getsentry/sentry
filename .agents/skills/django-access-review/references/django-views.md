# Django Views - Context for Investigation

This is background context to help you understand Django authorization patterns when investigating. Not a checklist.

## Where Authorization Can Happen

When tracing a request, check these layers:

```
URL conf → Middleware → View decorators → View class → Method → Query
```

### URL-Level

```python
# urls.py - decorators applied at routing
from django.contrib.admin.views.decorators import staff_member_required

urlpatterns = [
    path('admin/', staff_member_required(admin_view)),
]
```

### Middleware

```python
# settings.py MIDDLEWARE list
# Look for custom auth middleware that might set user context or enforce checks
```

### View Decorators

```python
@login_required
@permission_required('app.view_document')
@user_passes_test(lambda u: u.is_staff)
```

### CBV Mixins

```python
# Check the ENTIRE inheritance chain
class MyView(LoginRequiredMixin, PermissionRequiredMixin, DetailView):
    ...

# Also check for project-specific base classes
class MyView(BaseCompanyView, DetailView):
    # What does BaseCompanyView do?
```

### View Methods

```python
# get_queryset() - often where scoping happens
# get_object() - may have custom logic
# dispatch() - sometimes has permission checks
```

## DRF-Specific Layers

```python
# Permission classes - check what they actually do
permission_classes = [IsAuthenticated, IsOwner]

# get_queryset() - critical for scoping
def get_queryset(self):
    return Model.objects.filter(...)

# has_object_permission() - called by get_object()
def has_object_permission(self, request, view, obj):
    return obj.owner == request.user
```

## Key Insight

`has_object_permission()` is only called when `get_object()` is called. List views don't trigger it - they need `get_queryset()` scoping.
