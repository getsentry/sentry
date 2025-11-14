from typing import int
from sentry.testutils.helpers.options import override_options
from sentry.utils.sdk_crashes.sdk_crash_detection_config import (
    SdkName,
    build_sdk_crash_detection_configs,
)


@override_options(
    {
        "issues.sdk_crash_detection.cocoa.project_id": 1,
        "issues.sdk_crash_detection.cocoa.sample_rate": 0.1,
        "issues.sdk_crash_detection.react-native.project_id": 2,
        "issues.sdk_crash_detection.react-native.sample_rate": 0.2,
        "issues.sdk_crash_detection.react-native.organization_allowlist": [1],
        "issues.sdk_crash_detection.java.project_id": 3,
        "issues.sdk_crash_detection.java.sample_rate": 0.3,
        "issues.sdk_crash_detection.java.organization_allowlist": [2],
        "issues.sdk_crash_detection.native.project_id": 4,
        "issues.sdk_crash_detection.native.sample_rate": 0.4,
        "issues.sdk_crash_detection.native.organization_allowlist": [3],
        "issues.sdk_crash_detection.dart.project_id": 5,
        "issues.sdk_crash_detection.dart.sample_rate": 0.5,
        "issues.sdk_crash_detection.dart.organization_allowlist": [4],
        "issues.sdk_crash_detection.dotnet.project_id": 6,
        "issues.sdk_crash_detection.dotnet.sample_rate": 0.6,
        "issues.sdk_crash_detection.dotnet.organization_allowlist": [5],
    }
)
def test_build_sdk_crash_detection_configs() -> None:
    configs = build_sdk_crash_detection_configs()

    assert len(configs) == 6

    cocoa_config = configs[0]
    assert cocoa_config.sdk_name == SdkName.Cocoa
    assert cocoa_config.project_id == 1
    assert cocoa_config.sample_rate == 0.1
    assert cocoa_config.organization_allowlist == []

    react_native_config = configs[1]
    assert react_native_config.sdk_name == SdkName.ReactNative
    assert react_native_config.project_id == 2
    assert react_native_config.sample_rate == 0.2
    assert react_native_config.organization_allowlist == [1]

    java_config = configs[2]
    assert java_config.sdk_name == SdkName.Java
    assert java_config.project_id == 3
    assert java_config.sample_rate == 0.3
    assert java_config.organization_allowlist == [2]

    native_config = configs[3]
    assert native_config.sdk_name == SdkName.Native
    assert native_config.project_id == 4
    assert native_config.sample_rate == 0.4
    assert native_config.organization_allowlist == [3]

    dart_config = configs[4]
    assert dart_config.sdk_name == SdkName.Dart
    assert dart_config.project_id == 5
    assert dart_config.sample_rate == 0.5
    assert dart_config.organization_allowlist == [4]

    dotnet_config = configs[5]
    assert dotnet_config.sdk_name == SdkName.Dotnet
    assert dotnet_config.project_id == 6
    assert dotnet_config.sample_rate == 0.6
    assert dotnet_config.organization_allowlist == [5]


@override_options(
    {
        "issues.sdk_crash_detection.cocoa.project_id": 0,
        "issues.sdk_crash_detection.cocoa.sample_rate": 0.0,
        "issues.sdk_crash_detection.react-native.project_id": 2,
        "issues.sdk_crash_detection.react-native.sample_rate": 0.2,
        "issues.sdk_crash_detection.react-native.organization_allowlist": [1],
        "issues.sdk_crash_detection.java.project_id": 0,
        "issues.sdk_crash_detection.java.sample_rate": 0.0,
        "issues.sdk_crash_detection.java.organization_allowlist": [],
        "issues.sdk_crash_detection.native.project_id": 0,
        "issues.sdk_crash_detection.native.sample_rate": 0.0,
        "issues.sdk_crash_detection.native.organization_allowlist": [],
        "issues.sdk_crash_detection.dart.project_id": 0,
        "issues.sdk_crash_detection.dart.sample_rate": 0.0,
        "issues.sdk_crash_detection.dart.organization_allowlist": [],
        "issues.sdk_crash_detection.dotnet.project_id": 0,
        "issues.sdk_crash_detection.dotnet.sample_rate": 0.0,
        "issues.sdk_crash_detection.dotnet.organization_allowlist": [],
    }
)
def test_build_sdk_crash_detection_configs_only_react_native() -> None:
    configs = build_sdk_crash_detection_configs()

    assert len(configs) == 1
    react_native_config = configs[0]
    assert react_native_config.sdk_name == SdkName.ReactNative
    assert react_native_config.project_id == 2
    assert react_native_config.sample_rate == 0.2
    assert react_native_config.organization_allowlist == [1]


@override_options(
    {
        "issues.sdk_crash_detection.cocoa.project_id": 1.0,
        "issues.sdk_crash_detection.cocoa.sample_rate": 0.0,
        "issues.sdk_crash_detection.react-native.project_id": 2,
        "issues.sdk_crash_detection.react-native.sample_rate": 0.2,
        "issues.sdk_crash_detection.react-native.organization_allowlist": [1],
        "issues.sdk_crash_detection.java.project_id": 3,
        "issues.sdk_crash_detection.java.sample_rate": 0.0,
        "issues.sdk_crash_detection.java.organization_allowlist": [2],
        "issues.sdk_crash_detection.native.project_id": 4,
        "issues.sdk_crash_detection.native.sample_rate": 0.0,
        "issues.sdk_crash_detection.native.organization_allowlist": [3],
        "issues.sdk_crash_detection.dart.project_id": 5,
        "issues.sdk_crash_detection.dart.sample_rate": 0.0,
        "issues.sdk_crash_detection.dart.organization_allowlist": [4],
        "issues.sdk_crash_detection.dotnet.project_id": 6,
        "issues.sdk_crash_detection.dotnet.sample_rate": 0.0,
        "issues.sdk_crash_detection.dotnet.organization_allowlist": [5],
    }
)
def test_build_sdk_crash_detection_configs_no_sample_rate() -> None:
    configs = build_sdk_crash_detection_configs()

    assert len(configs) == 1
    react_native_config = configs[0]
    assert react_native_config.sdk_name == SdkName.ReactNative
    assert react_native_config.project_id == 2
    assert react_native_config.sample_rate == 0.2
    assert react_native_config.organization_allowlist == [1]


@override_options(
    {
        "issues.sdk_crash_detection.cocoa.project_id": 0,
        "issues.sdk_crash_detection.cocoa.sample_rate": 0.0,
        "issues.sdk_crash_detection.react-native.project_id": 0,
        "issues.sdk_crash_detection.react-native.sample_rate": 0.0,
        "issues.sdk_crash_detection.react-native.organization_allowlist": [1],
        "issues.sdk_crash_detection.java.project_id": 0,
        "issues.sdk_crash_detection.java.sample_rate": 0.0,
        "issues.sdk_crash_detection.java.organization_allowlist": [1],
        "issues.sdk_crash_detection.native.project_id": 0,
        "issues.sdk_crash_detection.native.sample_rate": 0.0,
        "issues.sdk_crash_detection.native.organization_allowlist": [],
        "issues.sdk_crash_detection.dart.project_id": 0,
        "issues.sdk_crash_detection.dart.sample_rate": 0.0,
        "issues.sdk_crash_detection.dart.organization_allowlist": [],
        "issues.sdk_crash_detection.dotnet.project_id": 0,
        "issues.sdk_crash_detection.dotnet.sample_rate": 0.0,
        "issues.sdk_crash_detection.dotnet.organization_allowlist": [],
    }
)
def test_build_sdk_crash_detection_default_configs() -> None:
    assert len(build_sdk_crash_detection_configs()) == 0
