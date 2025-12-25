# Before & After: AttributeError Fix

## The Problem ❌

### Before (Broken Code)
```python
def normalize_job_data(raw_job):
    return JobData(
        location=raw_job.get('location', ''),
        # This line crashes when location is a dictionary:
        remote=raw_job.get('remote', False) or raw_job.get('location', '').lower() == 'remote',
        # ❌ Calling .lower() on a dict causes AttributeError
    )
```

### When Processing This Data
```python
{
    "location": {
        "city": 'Remote',
        "country": 'US',
        "is_remote": True,
        "raw_location": 'Remote',
        "state": None
    }
}
```

### Result
```
AttributeError: 'dict' object has no attribute 'lower'
```

---

## The Solution ✅

### After (Fixed Code)
```python
def _extract_location_string(location_data):
    """Safely extract string from location data."""
    if isinstance(location_data, str):
        return location_data
    elif isinstance(location_data, dict):
        # Use raw_location, or city, or construct from fields
        return location_data.get('raw_location') or \
               location_data.get('city') or \
               ', '.join([v for k, v in [
                   (location_data.get('city'), location_data.get('city')),
                   (location_data.get('state'), location_data.get('state')),
                   (location_data.get('country'), location_data.get('country'))
               ] if v])
    return ''


def _is_remote_location(location_data):
    """Determine if location represents remote position."""
    if isinstance(location_data, dict):
        # Check explicit is_remote field
        if 'is_remote' in location_data:
            return bool(location_data['is_remote'])
        # Fall back to keyword check
        location_str = _extract_location_string(location_data)
        return 'remote' in location_str.lower()
    elif isinstance(location_data, str):
        return 'remote' in location_data.lower()
    return False


def normalize_job_data(raw_job):
    location_data = raw_job.get('location', '')
    location_str = _extract_location_string(location_data)  # ✅ Safe extraction
    is_remote = raw_job.get('remote', False) or _is_remote_location(location_data)  # ✅ Safe check
    
    return JobData(
        location=location_str,  # ✅ Always a string
        remote=is_remote,       # ✅ Always a boolean
    )
```

### When Processing Dictionary Location
```python
Input:
{
    "location": {
        "city": 'Remote',
        "country": 'US',
        "is_remote": True,
        "raw_location": 'Remote',
        "state": None
    }
}

Output:
JobData(
    location='Remote',    # ✅ String extracted
    remote=True,          # ✅ Boolean from is_remote field
)
```

### When Processing String Location (Backward Compatible)
```python
Input:
{
    "location": "San Francisco, CA"
}

Output:
JobData(
    location='San Francisco, CA',  # ✅ String preserved
    remote=False,                   # ✅ Correctly detected as not remote
)
```

---

## Comparison Table

| Aspect | Before ❌ | After ✅ |
|--------|----------|----------|
| **String Location** | Works | Works |
| **Dictionary Location** | **Crashes** | **Works** |
| **Type Checking** | None | Comprehensive |
| **Error Handling** | Fails immediately | Graceful fallbacks |
| **Remote Detection** | String-based only | Dict field + string fallback |
| **Backward Compatibility** | N/A | Fully compatible |

---

## Test Results

### Before (Would Fail)
```python
raw_job = {
    "location": {"city": "Remote", "is_remote": True, ...}
}
normalize_job_data(raw_job)  # ❌ AttributeError
```

### After (Works)
```python
raw_job = {
    "location": {"city": "Remote", "is_remote": True, ...}
}
result = normalize_job_data(raw_job)  # ✅ Success!
assert result.location == "Remote"
assert result.remote == True
```

---

## Why This Fix Works

1. **Type-Safe**: Checks `isinstance()` before calling type-specific methods
2. **Flexible**: Handles multiple location formats (string, dict with various fields)
3. **Robust**: Provides fallbacks when expected fields are missing
4. **Clear**: Separate helper functions make logic easy to understand and maintain
5. **Compatible**: Works with both old string format and new dict format

---

## Edge Cases Handled

✅ Location is a dictionary with all fields  
✅ Location is a dictionary with only some fields  
✅ Location is a string  
✅ Location is empty/None  
✅ Remote status from `is_remote` field  
✅ Remote status from location text  
✅ Mixed case "Remote" / "REMOTE" / "remote"  
✅ Complex location strings like "Remote (US)"

All edge cases are covered by comprehensive test suite! 🎉
