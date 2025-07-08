# Dart/Flutter Stack Trace Enhancement Rules Testing

## Overview

This document describes the test suite for Dart and Flutter specific enhancement rules in Sentry's stack trace processing. The tests verify that Dart/Flutter frames are correctly marked as "in-app" or "not in-app" based on the rules defined in `newstyle@2023-01-11.txt`.

## Test File: `tests/sentry/grouping/test_enhancer_dart_flutter.py`

### Dart/Flutter Enhancement Rules Tested

The test file covers all Dart/Flutter specific rules from the enhancement configuration:

#### 1. Android Dart App Files (Marked as in-app)
**Rule:** `family:native stack.package:/data/app/** stack.abs_path:**/*.dart +app`
- Marks Dart files within Android app packages as in-app
- Requires BOTH conditions: package path starts with `/data/app/` AND file ends with `.dart`
- Example: Files in `/data/app/com.example.myapp-1/base.apk` with paths like `package:myapp/main.dart`

#### 2. Dart SDK Files (Not in-app)
**Rule:** `family:javascript stack.abs_path:org-dartlang-sdk:///** -app -group`
- Marks Dart SDK files as not in-app
- Applies to JavaScript platform frames
- Example: `org-dartlang-sdk:///sdk/lib/core/object.dart`

#### 3. Flutter Framework Packages (Not in-app)
Two rules for different platforms:
- **JavaScript:** `family:javascript module:**/packages/flutter/** -app`
- **Native:** `family:native stack.abs_path:**/packages/flutter/** -app`
- Marks Flutter framework code as not in-app
- Example: `packages/flutter/src/widgets/framework.dart`

#### 4. Sentry Dart SDK Packages (Not in-app)
Multiple rules for various Sentry packages:
- `stack.abs_path:package:sentry/** -app -group`
- `stack.abs_path:package:sentry_flutter/** -app -group`
- Additional packages: `sentry_logging`, `sentry_dio`, `sentry_file`, `sentry_hive`, `sentry_isar`, `sentry_sqflite`, `sentry_drift`, `sentry_link`, `sentry_firebase_remote_config`
- Example: `package:sentry_flutter/sentry_flutter.dart`

#### 5. Pub Cache Dependencies (Not in-app)
**Rule:** `family:native stack.abs_path:**/.pub-cache/** -app`
- Marks third-party packages from `.pub-cache` as not in-app
- `.pub-cache` is Dart's equivalent to `node_modules`
- Example: `/Users/dev/.pub-cache/hosted/pub.dev/dio-4.0.0/lib/dio.dart`

### Test Categories

#### Basic Functionality Tests
- `test_dart_android_app_files_are_in_app`: Verifies Android app Dart files are marked as in-app
- `test_dart_sdk_not_in_app`: Verifies Dart SDK files are not in-app
- `test_flutter_packages_not_in_app`: Verifies Flutter framework is not in-app
- `test_sentry_dart_packages_not_in_app`: Verifies Sentry packages are not in-app
- `test_pub_cache_not_in_app`: Verifies pub cache packages are not in-app

#### Advanced Tests
- `test_user_dart_files_default_behavior`: Tests that user files not matching any rules retain default behavior
- `test_platform_specific_rules`: Verifies platform-specific rules only apply to correct platforms
- `test_complex_dart_stacktrace_scenario`: Tests realistic Flutter error stacktrace with multiple frame types
- `test_edge_cases`: Tests edge cases like empty fields, case sensitivity, partial matches

### Example Test Case

```python
def test_dart_android_app_files_are_in_app(self):
    """Test that Dart files in Android apps are marked as in-app"""
    frame = {
        "package": "/data/app/com.example.myapp-1/base.apk",
        "abs_path": "package:myapp/main.dart",
    }
    result = self.apply_rules_to_frame(frame, platform="native")
    assert result["in_app"] is True
```

### Key Testing Insights

1. **Compound Rules**: The Android Dart app rule requires BOTH package and abs_path conditions
2. **Platform Specificity**: Some rules only apply to specific platforms (native vs javascript)
3. **Pattern Matching**: Rules use glob patterns (`**`) for flexible path matching
4. **Case Sensitivity**: Rules are case-sensitive (e.g., `package:sentry` won't match `package:SENTRY`)
5. **Extension Requirements**: The `.dart` extension is required for certain rules to match

### Running the Tests

```bash
pytest tests/sentry/grouping/test_enhancer_dart_flutter.py
```

### Benefits

- **Correctness**: Ensures Dart/Flutter frames are classified correctly
- **Regression Prevention**: Prevents breaking changes to Dart/Flutter support
- **Documentation**: Tests serve as examples of how rules work
- **Coverage**: All Dart/Flutter specific rules are tested with various scenarios
