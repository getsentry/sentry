# FastAPI Route Ordering Quick Reference

## ⚠️ Common Pitfall: Route Order Matters!

FastAPI matches routes in **registration order**. The first matching route wins.

---

## ❌ Don't Do This

```python
@router.get("/{id}")           # Matches everything - registered first!
@router.get("/search")         # Never reached
@router.get("/stats")          # Never reached
```

**Result:** All requests go to `/{id}`, even `/search` and `/stats`

---

## ✅ Do This Instead

```python
@router.get("/search")         # Specific - registered first
@router.get("/stats")          # Specific - registered first
@router.get("/{id}")           # General - registered last
```

**Result:** Each endpoint works correctly

---

## Rule of Thumb

**Register routes from MOST specific to LEAST specific:**

```python
# 1. Literal paths (most specific)
@router.get("/search")
@router.get("/admin")
@router.get("/me")

# 2. Paths with multiple segments
@router.get("/{id}/details")
@router.get("/{id}/settings")

# 3. Simple parameterized paths (least specific)
@router.get("/{id}")
```

---

## Real-World Examples

### User Routes
```python
# ✅ Correct order
@router.get("/users/me")              # Logged-in user
@router.get("/users/search")          # Search users
@router.get("/users/admin")           # Admin panel
@router.get("/users/{user_id}")       # Any user by ID
```

### Product Routes
```python
# ✅ Correct order
@router.get("/products/featured")     # Featured products
@router.get("/products/search")       # Search products
@router.get("/products/categories")   # List categories
@router.get("/products/{product_id}") # Specific product
```

### Job Routes (Our Fix)
```python
# ✅ Correct order (FIXED)
@router.get("/jobs/search")           # Search jobs
@router.get("/jobs/{job_id}")         # Specific job

# ❌ Wrong order (BROKEN)
@router.get("/jobs/{job_id}")         # Matches "search"!
@router.get("/jobs/search")           # Never reached
```

---

## Testing Your Routes

Always test that literal paths work:

```python
def test_literal_paths_work():
    """Ensure /search isn't matched as {id}"""
    
    # Should match /search endpoint, not /{id}
    response = client.get("/api/users/search?q=john")
    assert response.status_code == 200
    assert "results" in response.json()  # Search response
    assert "id" not in response.json()   # Not a single user
```

---

## Debugging Route Issues

If a specific path returns unexpected results:

### 1. Check Route Order
```python
# Print all routes in order
for route in app.routes:
    print(f"{route.path} - {route.methods}")
```

### 2. Look for the Bug Pattern
```
/{param}  <- Registered first? ❌ BUG!
/literal  <- Registered second? Will never match!
```

### 3. Reorder Routes
Move specific routes **above** parameterized routes.

---

## Summary

| Pattern | Status | Why |
|---------|--------|-----|
| `/literal` then `/{param}` | ✅ Good | Specific routes checked first |
| `/{param}` then `/literal` | ❌ Bug | Param matches everything |
| `/long/path/{id}` then `/{id}` | ✅ Good | More segments = more specific |
| `/{id}/sub` then `/{id}` | ✅ Good | Longer paths first |

**Golden Rule:** Specific routes first, general routes last!

---

## Quick Fix Checklist

- [ ] List all routes in the file
- [ ] Identify literal paths (e.g., `/search`, `/me`)
- [ ] Identify parameterized paths (e.g., `/{id}`)
- [ ] Move literal paths **above** parameterized paths
- [ ] Test that literal paths work correctly
- [ ] Verify parameterized paths still work

---

## Related FastAPI Docs

- [Path Parameters - Order Matters](https://fastapi.tiangolo.com/tutorial/path-params/#order-matters)
- [Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [Path Operation Configuration](https://fastapi.tiangolo.com/tutorial/path-operation-configuration/)
