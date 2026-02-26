# Tiered xdist v2 — Change Log

## 1. Bug Fixes and Unused Plugin Cleanup

### 1a. Exclude `.venv/` from pyc cleanup

**File:** `.github/actions/setup-sentry/action.yml` (lines 93-94)

**What:** Added `-not -path './.venv/*'` to the two `find` commands that delete `__pycache__` dirs and `.pyc` files.

**Why:** The "Clear Python cache" step runs `find` from the repo root, which includes `.venv/`. The previous step (`action-setup-venv`) just restored the venv from cache — including compiled bytecode. Deleting it forces Python to recompile every installed package on first import during every CI run, making the venv cache less effective than intended.

### 1b. Add `django_db` marker to `test_buffer.py`

**File:** `tests/sentry/spans/test_buffer.py` (after imports, before `DEFAULT_OPTIONS`)

**What:** Added `pytestmark = [pytest.mark.django_db]`.

**Why:** `flush_segments()` has a code path (`_load_segment_data` → `Project.objects.get_from_cache()`) that requires DB access. Without the marker, this causes "Database access not allowed" under `--dist=load` where tests interleave across workers and pytest-django properly blocks unmarked DB access. Also causes flaky reruns under `--dist=loadfile`. This is a rare case — almost all Sentry tests inherit from `TestCase` (which implicitly grants DB access). `test_buffer.py` is one of the few function-based test files that relies on pytest-django's marker system instead.

### 1c. Fix flaky dashboard widget ordering

**File:** `tests/sentry/dashboards/endpoints/test_organization_dashboard_details.py` (lines 918, 924)

**What:** Added `order=2` to `widget_3` and `order=3` to `widget_4` in `OrganizationDashboardDetailsPutTest.setUp()`.

**Why:** `DashboardWidget.order` is `BoundedPositiveIntegerField(null=True)`. The parent class already sets `order=0` and `order=1` on `widget_1`/`widget_2`, but `widget_3`/`widget_4` were left as NULL. `ORDER BY order` with NULL values produces nondeterministic ordering in PostgreSQL, causing intermittent assertion failures on widget position.

### 1d. Conditional selenium plugin loading

**File:** `src/sentry/testutils/pytest/__init__.py`

**What:** Moved `sentry.testutils.pytest.selenium` out of the static `pytest_plugins` list. It's now appended conditionally only when `SENTRY_SKIP_SELENIUM_PLUGIN != "1"`.

**Why:** selenium is a 23MB package imported at module level. We should avoid loading it when not running acceptance tests. Currently we pass `--ignore tests/acceptance` but that only prevents test collection and not plugin loading.
