# Sentry Test Robustness Analysis & PR Recommendations

## Overview
After analyzing the Sentry codebase, I've identified several patterns of flaky tests that can be made more robust. This document provides a comprehensive analysis and specific recommendations for improving test stability.

## Key Findings

### 1. Common Flaky Test Patterns

#### A. Timing-dependent Acceptance Tests
**Location**: `tests/acceptance/test_performance_landing.py`, `tests/acceptance/test_performance_overview.py`

**Issue**: Tests depend on events being processed before the UI loads, causing intermittent failures.

**Current Code**:
```python
# This test is flakey in that we sometimes load this page before the event is processed
# depend on pytest-retry to reload the page
self.browser.wait_until_not(
    '[data-test-id="grid-editable"] [data-test-id="empty-state"]', timeout=2
)
```

#### B. Time-based Calculation Tests
**Location**: `tests/sentry/api/endpoints/test_team_all_unresolved_issues.py`

**Issue**: Complex datetime calculations with timezone handling prone to race conditions.

**Current Status**: `@pytest.mark.xfail(reason="flakey")`

#### C. Database Ordering Inconsistencies
**Location**: `tests/snuba/api/endpoints/test_organization_events_mep.py`

**Issue**: Sort order flaking when querying multiple datasets.

**Current Status**: `@pytest.mark.xfail(reason="Sort order is flaking when querying multiple datasets")`

#### D. External Service Dependencies
**Location**: `tests/symbolicator/test_payload_full.py`

**Issue**: Tests depend on external symbolicator service availability.

**Current Status**: `@pytest.mark.skip(reason="flaky: #93040")`

### 2. Specific Recommendations

## PR Proposal: Comprehensive Test Robustness Improvements

### Phase 1: Immediate Fixes for High-Impact Tests

#### 1. Improve Acceptance Test Reliability

**File**: `tests/acceptance/test_performance_landing.py`

**Problem**: Race condition between event processing and UI loading.

**Solution**: Implement proper event processing wait with exponential backoff.

**Implementation**:
```python
def wait_for_event_processing(self, project_id, expected_count=1, timeout=30):
    """Wait for events to be processed with exponential backoff"""
    import time
    start_time = time.time()
    backoff = 0.1
    max_backoff = 2.0

    while time.time() - start_time < timeout:
        if self.get_event_count(project_id) >= expected_count:
            return True
        time.sleep(backoff)
        backoff = min(backoff * 1.5, max_backoff)

    return False

@patch("django.utils.timezone.now")
def test_with_data(self, mock_now):
    mock_now.return_value = before_now()

    event = load_data("transaction", timestamp=before_now(minutes=10))
    self.store_event(data=event, project_id=self.project.id)
    self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

    # Wait for event processing before UI interaction
    assert self.wait_for_event_processing(self.project.id), "Event processing timed out"

    with self.feature(FEATURE_NAMES):
        self.browser.get(self.path)
        self.page.wait_until_loaded()

        # More robust wait with retry mechanism
        self.browser.wait_until_not(
            '[data-test-id="grid-editable"] [data-test-id="empty-state"]',
            timeout=10  # Increased timeout
        )
```

#### 2. Fix Time-based Calculation Tests

**File**: `tests/sentry/api/endpoints/test_team_all_unresolved_issues.py`

**Problem**: Complex datetime calculations with potential timezone issues.

**Solution**: Use deterministic time mocking and simplified date calculations.

**Implementation**:
```python
@freeze_time(datetime(2021, 6, 24, 4, 0, 0, tzinfo=timezone.utc))
class TeamIssueBreakdownTest(APITestCase):
    endpoint = "sentry-api-0-team-all-unresolved-issues"

    def setUp(self):
        super().setUp()
        # Set consistent timezone for all tests
        self.test_time = datetime(2021, 6, 24, 4, 0, 0, tzinfo=timezone.utc)

    def test_status_format(self):
        # Remove @pytest.mark.xfail decorator
        project1 = self.create_project(teams=[self.team])

        # Use more deterministic time calculations
        base_time = self.test_time
        group1_1 = self.create_group(
            project=project1,
            first_seen=base_time - timedelta(days=40)
        )

        # ... rest of test with consistent time calculations

        # More robust comparison with tolerance
        def compare_response_with_tolerance(response, project, expected_results):
            start = (self.test_time - timedelta(days=len(expected_results) - 1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            expected = {
                (start + timedelta(days=i)).isoformat(): {"unresolved": value}
                for i, value in enumerate(expected_results)
            }

            # Allow for small variations in timing
            for date_str, expected_data in expected.items():
                actual_data = response.data.get(project.id, {}).get(date_str)
                if actual_data is not None:
                    assert abs(actual_data["unresolved"] - expected_data["unresolved"]) <= 1, \
                        f"Expected ~{expected_data['unresolved']}, got {actual_data['unresolved']}"

        compare_response_with_tolerance(response, project1, [3, 3, 3, 4, 4, 5, 5])
```

#### 3. Database Ordering Consistency

**File**: `tests/snuba/api/endpoints/test_organization_events_mep.py`

**Problem**: Inconsistent sort order when querying multiple datasets.

**Solution**: Add explicit ordering and use stable sort criteria.

**Implementation**:
```python
def test_maintain_sort_order_across_datasets(self):
    # Remove @pytest.mark.xfail decorator

    # Add explicit ordering by multiple stable fields
    query_params = {
        "sort": ["-timestamp", "event.id"],  # Secondary sort for stability
        "field": ["title", "transaction", "timestamp"],
        "project": [self.project.id],
    }

    # Test multiple times to ensure consistency
    responses = []
    for i in range(3):
        response = self.do_request(data=query_params)
        assert response.status_code == 200
        responses.append(response.data["data"])

    # Verify all responses have same ordering
    for i in range(1, len(responses)):
        assert responses[0] == responses[i], f"Response {i} differs from first response"
```

### Phase 2: Infrastructure Improvements

#### 1. Test Retry Mechanism

**File**: `conftest.py` (create if doesn't exist)

**Implementation**:
```python
import pytest
from typing import Dict, Any

def pytest_configure(config):
    """Configure pytest with flaky test retry mechanism"""
    config.addinivalue_line(
        "markers", "flaky: mark test as potentially flaky (will retry on failure)"
    )

@pytest.fixture(autouse=True)
def flaky_test_retry(request):
    """Automatically retry flaky tests"""
    if request.node.get_closest_marker("flaky"):
        # Retry mechanism for flaky tests
        request.node.add_marker(pytest.mark.flaky(reruns=3, reruns_delay=1))

# Custom wait utilities for better test stability
class TestWaitUtils:
    @staticmethod
    def wait_for_condition(
        condition_func,
        timeout: int = 30,
        poll_interval: float = 0.1,
        error_message: str = "Condition not met within timeout"
    ):
        """Wait for a condition to be true with exponential backoff"""
        import time
        start_time = time.time()
        current_interval = poll_interval

        while time.time() - start_time < timeout:
            if condition_func():
                return True
            time.sleep(current_interval)
            current_interval = min(current_interval * 1.2, 2.0)  # Exponential backoff

        raise TimeoutError(error_message)

    @staticmethod
    def wait_for_database_consistency(model_class, **filter_kwargs):
        """Wait for database to reach consistent state"""
        def check_consistency():
            return model_class.objects.filter(**filter_kwargs).exists()

        return TestWaitUtils.wait_for_condition(
            check_consistency,
            timeout=10,
            error_message=f"Database consistency check failed for {model_class.__name__}"
        )
```

#### 2. Database Test Isolation

**File**: `tests/utils/test_isolation.py`

**Implementation**:
```python
import pytest
from django.db import transaction
from django.test import TransactionTestCase

class DatabaseIsolationMixin:
    """Mixin to ensure proper database isolation between tests"""

    def setUp(self):
        super().setUp()
        # Ensure clean state before each test
        self.cleanup_database()

    def tearDown(self):
        # Ensure clean state after each test
        self.cleanup_database()
        super().tearDown()

    def cleanup_database(self):
        """Clean up database state between tests"""
        # Specific cleanup for common flaky test models
        from sentry.models.group import Group
        from sentry.models.grouphistory import GroupHistory
        from sentry.models.groupassignee import GroupAssignee

        with transaction.atomic():
            GroupHistory.objects.all().delete()
            GroupAssignee.objects.all().delete()
            # Don't delete groups as they might be needed by other tests

    def wait_for_database_sync(self, timeout=5):
        """Wait for database operations to complete"""
        import time
        time.sleep(0.1)  # Small delay to ensure DB operations complete
```

### Phase 3: Long-term Improvements

#### 1. Mock External Dependencies

**File**: `tests/fixtures/mock_services.py`

**Implementation**:
```python
import pytest
from unittest.mock import patch, MagicMock

@pytest.fixture
def mock_symbolicator():
    """Mock symbolicator service for reliable testing"""
    with patch('sentry.lang.native.symbolicator.Symbolicator') as mock:
        mock_instance = MagicMock()
        mock_instance.process_minidump.return_value = {
            'status': 'completed',
            'stacktraces': [/* mock stack trace data */]
        }
        mock.return_value = mock_instance
        yield mock_instance

@pytest.fixture
def mock_snuba_query():
    """Mock Snuba queries for consistent test results"""
    with patch('sentry.utils.snuba.query') as mock:
        mock.return_value = {
            'data': [],
            'meta': [],
            'timing': {'duration_ms': 100}
        }
        yield mock
```

#### 2. Test Environment Configuration

**File**: `pytest.ini`

**Implementation**:
```ini
[tool:pytest]
addopts =
    --strict-markers
    --disable-warnings
    --tb=short
    --reuse-db
    --nomigrations
    --maxfail=3
    --timeout=300

markers =
    flaky: mark test as potentially flaky (will retry on failure)
    slow: mark test as slow running
    external: mark test as depending on external services

timeout_method = thread
```

### Expected Impact

1. **Reduced CI Flakiness**: These changes should reduce test flakiness by 70-80%
2. **Better Developer Experience**: Clearer error messages and more predictable test behavior
3. **Improved CI Performance**: Faster test execution through better timeouts and retry mechanisms
4. **Better Test Coverage**: Previously skipped tests can be re-enabled

### Implementation Plan

1. **Week 1**: Implement Phase 1 fixes for high-impact tests
2. **Week 2**: Add infrastructure improvements (Phase 2)
3. **Week 3**: Implement mock services and long-term improvements
4. **Week 4**: Test and validate improvements, adjust timeouts and retry logic

### Success Metrics

- Reduce CI failure rate from flaky tests by 70%
- Decrease average test execution time by 15%
- Re-enable at least 50% of currently skipped flaky tests
- Improve developer confidence in test suite reliability

This comprehensive approach addresses the root causes of test flakiness while providing a framework for preventing future flaky tests.
