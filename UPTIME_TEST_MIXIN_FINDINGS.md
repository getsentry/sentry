# UptimeTestCaseMixin Setup/Cleanup Issue Found

## 🎯 Issue Identified

Found test classes that **override setup but don't get proper cleanup** of the UptimeTestCaseMixin context providers.

## 📍 Problem Location

**File**: `tests/sentry/uptime/endpoints/__init__.py`

```python
class UptimeAlertBaseEndpointTest(APITestCase):  # ❌ Missing UptimeTestCaseMixin
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
```

## 🔗 Affected Classes

### 1. ProjectUptimeAlertCheckIndexEndpoint
**File**: `tests/sentry/uptime/endpoints/test_project_uptime_alert_check_index.py`
```python
class ProjectUptimeAlertCheckIndexEndpoint(
    ProjectUptimeAlertCheckIndexBaseTest, UptimeCheckSnubaTestCase
):
```

### 2. OrganizationUptimeCheckIndexEndpointTest  
**File**: `tests/sentry/uptime/endpoints/test_organization_uptime_stats.py`
```python
class OrganizationUptimeCheckIndexEndpointTest(
    OrganizationUptimeStatsBaseTest, UptimeCheckSnubaTestCase
):
```

## ⚡ Root Cause

The inheritance chain goes:
- `UptimeAlertBaseEndpointTest` → `APITestCase` (not `UptimeTestCase`)
- Multiple inheritance doesn't include `UptimeTestCaseMixin`
- **Result**: RDAP mock context managers are never set up or cleaned up

This means these tests don't get the mock setup from UptimeTestCaseMixin (lines 3133-3153):
- `mock_resolve_hostname_ctx`
- `mock_resolve_rdap_provider_ctx` 
- `mock_requests_get_ctx`

## 🛠️ Fix

Change the base class to inherit from `UptimeTestCase`:

```python
# tests/sentry/uptime/endpoints/__init__.py
from sentry.testutils.cases import UptimeTestCase  # ✅ Fixed import

class UptimeAlertBaseEndpointTest(UptimeTestCase):  # ✅ Now includes UptimeTestCaseMixin
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
```

## 🧪 Risk Assessment

**Current Impact**: Low (tests don't directly call RDAP functions)
**Future Risk**: High (if endpoint tests start triggering RDAP queries, they'll fail with unmocked network calls)

---
*Found the issue where multiple inheritance bypasses UptimeTestCaseMixin setup/cleanup* ✓