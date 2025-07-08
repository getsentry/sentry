# Stack Trace Enhancement Rules Testing Summary

## Overview

I've created comprehensive tests for the Sentry stack trace enhancement rules found in `newstyle@2023-01-11.txt`. These tests verify whether stack frames are correctly marked as "in-app" or "not in-app" based on the defined rules.

## Test Implementation

### Main Test File: `tests/sentry/grouping/test_enhancer_inapp.py`

This test file contains a comprehensive test suite that:

1. **Loads the default enhancement rules** from `ENHANCEMENT_BASES["newstyle:2023-01-11"]`
2. **Applies rules to individual stack frames** using `apply_category_and_updated_in_app_to_frames()`
3. **Verifies the `in_app` status** after rules are applied

### Key Test Categories

#### 1. iOS App Bundle Tests
- Tests that iOS app bundles are correctly marked as in-app
- Covers paths like `/var/containers/Bundle/Application/**` and `/private/var/containers/Bundle/Application/**`
- Also tests iOS simulator paths

#### 2. System Library Tests
- Verifies system libraries are NOT marked as in-app
- Tests paths like `/lib/**`, `/usr/lib/**`, `linux-gate.so*`

#### 3. Language-Specific Tests
- **Rust**: Functions like `std::*`, `core::*`, `alloc::*` are not in-app
- **JavaScript**: Node modules, CDN URLs are not in-app
- **Java/Kotlin**: Framework modules are not in-app
- **Dart/Flutter**: Flutter SDK and Sentry packages are not in-app

#### 4. Sentry SDK Tests
- Ensures Sentry's own SDK functions are not marked as in-app
- Tests functions like `kscm_*`, `sentrycrash_*`, `-[SentryClient *]`

#### 5. Category Assignment Tests
- Verifies frames get correct categories (system, std, ui, framework, etc.)
- Example: `UIKit` gets category "ui", `std::vector` gets category "std"

#### 6. State Tracking Tests
- Tests that original `in_app` values are tracked when changed
- `orig_in_app` is set to:
  - `-1` when original was `None`
  - `1` when original was `True`
  - `0` when original was `False`

### Example Test Case

```python
def test_ios_app_bundle_is_in_app(self):
    """iOS app bundles should be marked as in-app"""
    frame = {"package": "/var/containers/Bundle/Application/12345/MyApp.app/MyApp"}
    result = self.apply_rules_to_frame(frame)
    assert result["in_app"] is True
```

### How Rules Work

1. **Matchers**: Rules match based on attributes like:
   - `package`: The binary/library path
   - `function`: The function name
   - `module`: The module name
   - `path`/`abs_path`: File paths
   - `family`: Platform family (native, javascript, etc.)

2. **Actions**: When matched, rules apply actions:
   - `+app`: Mark as in-app
   - `-app`: Mark as not in-app
   - `category=X`: Assign a category
   - `+group`/`-group`: Affects grouping (not tested here)

3. **Rule Order**: Rules are applied in order, later rules can override earlier ones

### Edge Cases Tested

- Empty packages/functions
- Path traversal attempts
- Platform-specific rules only applying to correct platforms
- Mixed rules where multiple conditions affect the outcome

## Running the Tests

The test file follows standard pytest patterns and can be run with:
```bash
pytest tests/sentry/grouping/test_enhancer_inapp.py
```

The tests use Sentry's test fixtures and base classes for proper setup and teardown.

## Benefits

These tests ensure:
1. **Consistency**: Rules behave as documented
2. **Regression Prevention**: Changes to rules won't break existing behavior
3. **Documentation**: Tests serve as examples of how rules work
4. **Coverage**: All major rule types and edge cases are tested
