# Multi-Tenant Isolation - Context for Investigation

Background on multi-tenant architectures. Use this to understand the ownership model you're investigating.

## Ownership Hierarchy

Most apps have layered ownership:

```
Organization/Tenant
    └── Team (optional)
        └── User
            └── Resource
```

**Key question**: At which level is authorization enforced?

## Common Implementation Patterns

### Tenant from Session

```python
# User's current tenant stored in session/request
request.user.organization
request.user.current_tenant
```

### Tenant from URL

```python
# URL: /orgs/{org_id}/projects/
# Question: Is user verified as member of this org?
```

### Automatic Scoping

```python
# Middleware sets tenant context
# Manager auto-filters by current tenant
# All queries implicitly scoped
```

## Questions When Investigating

1. **How is tenant determined?**
   - From authenticated user's profile?
   - From URL parameter?
   - From request header?

2. **If from URL, is membership validated?**
   - Can user access /orgs/999/ if they're not in org 999?

3. **Are all queries scoped to tenant?**
   - Check for auto-scoping managers
   - Check for explicit tenant filters

4. **Can user switch context to another tenant?**
   - If yes, is that switch validated?

## The Core Multi-Tenant Question

**"Can a user in Organization A access data belonging to Organization B?"**

Trace the code to answer this. Check:
- Where org context comes from
- Whether membership is validated
- Whether queries are scoped to that org
