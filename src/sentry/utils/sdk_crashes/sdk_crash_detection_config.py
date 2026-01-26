from collections.abc import Sequence
from dataclasses import dataclass, field
from enum import Enum, unique
from typing import TypedDict

from sentry import options
from sentry.utils.sdk_crashes.path_replacer import (
    FixedPathReplacer,
    KeepAfterPatternMatchPathReplacer,
    KeepFieldPathReplacer,
    PathReplacer,
)


@dataclass
class FunctionAndPathPattern:
    """Both the function and path pattern must match for a frame to be considered a SDK frame."""

    function_pattern: str
    path_pattern: str


@dataclass(frozen=True)
class FunctionAndModulePattern:
    """Pattern for matching function and module to ignore SDK crashes.

    Use "*" as a wildcard to match any value.
    Examples:
    - FunctionAndModulePattern("specific.module", "invoke") - matches only "invoke" in "specific.module"
    - FunctionAndModulePattern("*", "invoke") - matches "invoke" in any module
    - FunctionAndModulePattern("specific.module", "*") - matches any function in "specific.module"
    """

    module_pattern: str
    function_pattern: str


@dataclass
class SDKFrameConfig:
    function_patterns: set[str]

    path_patterns: set[str]

    path_replacer: PathReplacer

    function_and_path_patterns: list[FunctionAndPathPattern] = field(default_factory=list)


@unique
class SdkName(Enum):
    Cocoa = "cocoa"
    ReactNative = "react-native"
    Java = "java"
    Native = "native"
    Dart = "dart"
    Dotnet = "dotnet"


@dataclass
class SDKCrashDetectionConfig:
    """The SDK crash detection configuration per SDK."""

    """The name of the SDK to detect crashes for."""
    sdk_name: SdkName
    """The project to save the detected SDK crashes to"""
    project_id: int
    """The percentage of events to sample. 0.0 = 0%, 0.5 = 50% 1.0 = 100%."""
    sample_rate: float
    """The organization allowlist to detect crashes for. If empty, all organizations are allowed. Use the sample_rate to disable the SDK crash detection for all organizations."""
    organization_allowlist: list[int]
    """The SDK names including their min versions to detect crashes for. For example, {"sentry.cocoa": "8.2.0", "sentry.cocoa.react-native": "8.2.0"}."""
    sdk_names: dict[str, str]
    """Whether to report fatal errors. If true, both unhandled and fatal errors are reported.
    If false, only unhandled errors are reported."""
    report_fatal_errors: bool
    """The mechanism types to ignore. For example, {"console", "unhandledrejection"}. If empty, all mechanism types are captured."""
    ignore_mechanism_type: set[str]
    """The mechanism types to capture. For example, {"ANR", "AppExitInfo"}. Useful when you want to detect events that are neither unhandled nor fatal."""
    allow_mechanism_type: set[str]
    """The system library path patterns to detect system frames. For example, `System/Library/*` """
    system_library_path_patterns: set[str]
    """The configuration for detecting SDK frames."""
    sdk_frame_config: SDKFrameConfig
    """The function and module patterns to ignore when detecting SDK crashes. For example, FunctionAndModulePattern("*", "**SentrySDK crash**") for any module with that function"""
    sdk_crash_ignore_matchers: set[FunctionAndModulePattern]
    """The function patterns to ignore when they are the only SDK frames in the stacktrace.
    These frames are typically SDK instrumentation frames that intercept calls, such as swizzling or monkey patching,
    but don't cause crashes themselves. If there are other SDK frames anywhere in the stacktrace, the crash is still
    reported as an SDK crash. For example, SentrySwizzleWrapper is used for method swizzling and shouldn't be reported
    as an SDK crash when it's the only SDK frame, since it's highly unlikely the crash stems from that code."""
    sdk_crash_ignore_when_only_sdk_frame_matchers: set[FunctionAndModulePattern] = field(
        default_factory=set
    )


class SDKCrashDetectionOptions(TypedDict):
    project_id: int
    sample_rate: float
    organization_allowlist: list[int]


def build_sdk_crash_detection_configs() -> Sequence[SDKCrashDetectionConfig]:
    configs: list[SDKCrashDetectionConfig] = []

    cocoa_options = _get_options(sdk_name=SdkName.Cocoa, has_organization_allowlist=False)

    if cocoa_options:
        # Since changing the debug image type to macho (https://github.com/getsentry/sentry-cocoa/pull/2701)
        # released in sentry-cocoa 8.2.0 (https://github.com/getsentry/sentry-cocoa/blob/main/CHANGELOG.md#820),
        # the frames contain the full paths required for detecting system frames in is_system_library_frame.
        # Therefore, we require at least sentry-cocoa 8.2.0.

        cocoa_min_sdk_version = "8.2.0"

        cocoa_config = SDKCrashDetectionConfig(
            sdk_name=SdkName.Cocoa,
            project_id=cocoa_options["project_id"],
            sample_rate=cocoa_options["sample_rate"],
            organization_allowlist=cocoa_options["organization_allowlist"],
            sdk_names={
                "sentry.cocoa": cocoa_min_sdk_version,
                "sentry.cocoa.capacitor": cocoa_min_sdk_version,
                "sentry.cocoa.react-native": cocoa_min_sdk_version,
                "sentry.cocoa.dotnet": cocoa_min_sdk_version,
                "sentry.cocoa.flutter": cocoa_min_sdk_version,
                "sentry.cocoa.kmp": cocoa_min_sdk_version,
                "sentry.cocoa.unity": cocoa_min_sdk_version,
                "sentry.cocoa.unreal": cocoa_min_sdk_version,
            },
            report_fatal_errors=False,
            ignore_mechanism_type=set(),
            allow_mechanism_type=set(),
            system_library_path_patterns={r"/System/Library/**", r"/usr/lib/**"},
            sdk_frame_config=SDKFrameConfig(
                function_patterns={
                    r"*sentrycrash*",
                    r"*\[Sentry*",
                    r"*(Sentry*)*",  # Objective-C class extension categories
                    r"SentryMX*",  # MetricKit Swift classes
                },
                path_patterns={"Sentry**"},
                path_replacer=FixedPathReplacer(path="Sentry.framework"),
            ),
            sdk_crash_ignore_matchers={
                # [SentrySDK crash] is a testing function causing a crash.
                # Therefore, we don't want to mark it a as a SDK crash.
                FunctionAndModulePattern(
                    module_pattern="*",
                    function_pattern="**SentrySDK crash**",
                ),
                # [SentrySDKInternal crash] is a testing function causing a crash.
                # Therefore, we don't want to mark it a as a SDK crash.
                FunctionAndModulePattern(
                    module_pattern="*",
                    function_pattern="**SentrySDKInternal crash**",
                ),
                # SentryCrashExceptionApplicationHelper._crashOnException calls abort() intentionally, which would cause false positives.
                FunctionAndModulePattern(
                    module_pattern="*",
                    function_pattern="**SentryCrashExceptionApplicationHelper _crashOnException**",
                ),
            },
            sdk_crash_ignore_when_only_sdk_frame_matchers={
                # SentrySwizzleWrapper is used for method swizzling to intercept UI events.
                # When it's the only SDK frame, it's highly unlikely the crash stems from the SDK.
                # Only report as SDK crash if there are other SDK frames anywhere in the stacktrace.
                FunctionAndModulePattern(
                    module_pattern="*",
                    function_pattern="**SentrySwizzleWrapper**",
                ),
            },
        )
        configs.append(cocoa_config)

    react_native_options = _get_options(
        sdk_name=SdkName.ReactNative, has_organization_allowlist=True
    )
    if react_native_options:
        react_native_config = SDKCrashDetectionConfig(
            sdk_name=SdkName.ReactNative,
            project_id=react_native_options["project_id"],
            sample_rate=react_native_options["sample_rate"],
            organization_allowlist=react_native_options["organization_allowlist"],
            # 4.0.0 was released in June 2022, see https://github.com/getsentry/sentry-react-native/releases/tag/4.0.0.
            # We require at least sentry-react-native 4.0.0 to only detect SDK crashes for not too old versions.
            sdk_names={
                "sentry.javascript.react-native": "4.0.0",
            },
            report_fatal_errors=False,
            # used by the JS/RN SDKs
            # https://github.com/getsentry/sentry-javascript/blob/dafd51054d8b2ab2030fa0b16ad0fd70493b6e08/packages/core/src/integrations/captureconsole.ts#L60
            ignore_mechanism_type={"console"},
            allow_mechanism_type=set(),
            system_library_path_patterns={
                r"**/react-native/Libraries/**",
                r"**/react-native-community/**",
            },
            sdk_frame_config=SDKFrameConfig(
                function_patterns=set(),
                path_patterns={
                    # Development path
                    r"**/sentry-react-native/dist/**",
                    # Production paths taken from https://github.com/getsentry/sentry-react-native/blob/037d5fa2f38b02eaf4ca92fda569e0acfd6c3ebe/package.json#L68-L77
                    r"**/@sentry/react-native/**",
                    r"**/@sentry/browser/**",
                    r"**/@sentry/cli/**",
                    r"**/@sentry/core/**",
                    r"**/@sentry/hub/**",
                    r"**/@sentry/integrations/**",
                    r"**/@sentry/react/**",
                    r"**/@sentry/types/**",
                    r"**/@sentry/utils/**",
                },
                path_replacer=KeepAfterPatternMatchPathReplacer(
                    patterns={
                        r"\/sentry-react-native\/.*",
                        # We don't add the first / here because module isn't prefixed with /.
                        # We don't need to specify all production paths because the path replacer only runs for SDK frames.
                        r"@sentry\/*",
                    },
                    fallback_path="sentry-react-native",
                ),
            ),
            sdk_crash_ignore_matchers={
                # sentryWrapped rethrows the original error
                # https://github.com/getsentry/sentry-javascript/blob/a67ebc4f56fd20259bffbe194e8e92e968589c12/packages/browser/src/helpers.ts#L107
                FunctionAndModulePattern(
                    module_pattern="*",
                    function_pattern="sentryWrapped",
                ),
            },
        )
        configs.append(react_native_config)

    # 0.6.0 was released in Feb 2023, see https://github.com/getsentry/sentry-native/releases/tag/0.6.0.
    native_min_sdk_version = "0.6.0"

    java_options = _get_options(sdk_name=SdkName.Java, has_organization_allowlist=True)
    if java_options:
        # The sentry-java SDK sends SDK frames for uncaught exceptions since 7.0.0, which is required for detecting SDK crashes.
        # 7.0.0 was released in Nov 2023, see https://github.com/getsentry/sentry-java/releases/tag/7.0.0
        java_min_sdk_version = "7.0.0"

        java_config = SDKCrashDetectionConfig(
            sdk_name=SdkName.Java,
            project_id=java_options["project_id"],
            sample_rate=java_options["sample_rate"],
            organization_allowlist=java_options["organization_allowlist"],
            sdk_names={
                "sentry.java.android": java_min_sdk_version,
                "sentry.java.android.capacitor": java_min_sdk_version,
                "sentry.java.android.dotnet": java_min_sdk_version,
                "sentry.java.android.flutter": java_min_sdk_version,
                "sentry.java.android.kmp": java_min_sdk_version,
                "sentry.java.android.react-native": java_min_sdk_version,
                "sentry.java.android.timber": java_min_sdk_version,
                "sentry.java.android.unity": java_min_sdk_version,
                "sentry.java.android.unreal": java_min_sdk_version,
                "sentry.java.jul": java_min_sdk_version,
                "sentry.java.kmp": java_min_sdk_version,
                "sentry.java.log4j2": java_min_sdk_version,
                "sentry.java.logback": java_min_sdk_version,
                "sentry.java.opentelemetry.agent": java_min_sdk_version,
                "sentry.java.spring": java_min_sdk_version,
                "sentry.java.spring-boot": java_min_sdk_version,
                "sentry.java.spring-boot.jakarta": java_min_sdk_version,
                "sentry.java.spring.jakarta": java_min_sdk_version,
                # Required for getting Android Runtime Tracer crashes.
                # This is the same as for the native SDK Crash Detection Config
                "sentry.native.android": native_min_sdk_version,
            },
            report_fatal_errors=False,
            ignore_mechanism_type=set(),
            allow_mechanism_type={"ANR", "AppExitInfo"},
            system_library_path_patterns={
                r"java.**",
                r"javax.**",
                r"android.**",
                r"androidx.**",
                r"com.android.internal.**",
                r"kotlin.**",
                r"dalvik.**",
                r"/apex/com.android.*/lib*/**",
            },
            sdk_frame_config=SDKFrameConfig(
                function_patterns=set(),
                path_patterns={
                    r"io.sentry.**",
                },
                # The Android Runtime Tracer can crash when users enable profiling in the
                # Sentry Android SDK. While the Sentry Android SDK doesn't directly cause
                # these crashes, we must know when they occur. As Sentry doesn't appear in
                # the stacktrace, we filter for the following specific methods in the
                # specified Android apex packages.
                function_and_path_patterns=[
                    FunctionAndPathPattern(
                        function_pattern=r"*pthread_getcpuclockid*",
                        path_pattern=r"/apex/com.android.runtime/lib64/bionic/libc.so",
                    ),
                    FunctionAndPathPattern(
                        function_pattern=r"*art::Trace::StopTracing*",
                        path_pattern=r"/apex/com.android.art/lib64/libart.so",
                    ),
                    FunctionAndPathPattern(
                        function_pattern=r"*art::Thread::DumpState*",
                        path_pattern=r"/apex/com.android.art/lib64/libart.so",
                    ),
                ],
                path_replacer=KeepFieldPathReplacer(fields={"module", "filename", "package"}),
            ),
            sdk_crash_ignore_matchers={
                FunctionAndModulePattern(
                    module_pattern="io.sentry.graphql.SentryInstrumentation",
                    function_pattern="lambda$instrumentExecutionResult$0",
                ),
                FunctionAndModulePattern(
                    module_pattern="io.sentry.graphql.SentryGraphqlInstrumentation",
                    function_pattern="instrumentExecutionResultComplete",
                ),
            },
        )
        configs.append(java_config)

    native_options = _get_options(sdk_name=SdkName.Native, has_organization_allowlist=True)

    if native_options:
        native_config = SDKCrashDetectionConfig(
            sdk_name=SdkName.Native,
            project_id=native_options["project_id"],
            sample_rate=native_options["sample_rate"],
            organization_allowlist=native_options["organization_allowlist"],
            sdk_names={
                "sentry.native": native_min_sdk_version,
                "sentry.native.android": native_min_sdk_version,
                "sentry.native.android.capacitor": native_min_sdk_version,
                "sentry.native.android.flutter": native_min_sdk_version,
                "sentry.native.android.react-native": native_min_sdk_version,
                "sentry.native.android.unity": native_min_sdk_version,
                "sentry.native.android.unreal": native_min_sdk_version,
                "sentry.native.dotnet": native_min_sdk_version,
                "sentry.native.unity": native_min_sdk_version,
                "sentry.native.unreal": native_min_sdk_version,
            },
            report_fatal_errors=False,
            ignore_mechanism_type=set(),
            allow_mechanism_type=set(),
            system_library_path_patterns={
                # well known locations for unix paths
                r"/lib/**",
                r"/usr/lib/**",
                r"/usr/local/lib/**",
                r"/usr/local/Cellar/**",
                r"linux-gate.so*",
                # others
                r"/System/Library/Frameworks/**",  # macOS
                r"C:/Windows/**",
                r"/system/**",
                r"/vendor/**",
                r"**/libart.so",
                r"/apex/com.android.*/lib*/**",  # Android
            },
            sdk_frame_config=SDKFrameConfig(
                function_patterns={
                    r"sentry_*",  # public interface
                    r"sentry__*",  # module level interface
                    r"Java_io_sentry_android_ndk_*",  # JNI interface
                },
                path_patterns=set(),
                path_replacer=KeepAfterPatternMatchPathReplacer(
                    patterns={
                        r"sentry_.*",
                    },
                    fallback_path="sentry",
                ),
            ),
            sdk_crash_ignore_matchers=set(),
        )
        configs.append(native_config)

    dart_options = _get_options(sdk_name=SdkName.Dart, has_organization_allowlist=True)

    if dart_options:
        # Since 8.2.0 the Dart SDK sends SDK frames, which is required;
        # see https://github.com/getsentry/sentry-dart/releases/tag/8.2.0
        dart_min_sdk_version = "8.2.1"

        dart_config = SDKCrashDetectionConfig(
            sdk_name=SdkName.Dart,
            project_id=dart_options["project_id"],
            sample_rate=dart_options["sample_rate"],
            organization_allowlist=dart_options["organization_allowlist"],
            sdk_names={
                "sentry.dart": dart_min_sdk_version,
                "sentry.dart.flutter": dart_min_sdk_version,
            },
            report_fatal_errors=True,
            ignore_mechanism_type=set(),
            allow_mechanism_type=set(),
            system_library_path_patterns={
                # Dart
                r"org-dartlang-sdk:///**",
                r"dart:**/**",
                # Flutter
                r"**/packages/flutter/**",
                r"package:flutter/**",
            },
            sdk_frame_config=SDKFrameConfig(
                function_patterns=set(),
                path_patterns={
                    # non-obfuscated builds
                    r"package:sentry/**",  # sentry-dart
                    r"package:sentry_flutter/**",  # sentry-dart-flutter
                    # sentry-dart packages
                    r"package:sentry_logging/**",
                    r"package:sentry_dio/**",
                    r"package:sentry_file/**",
                    r"package:sentry_sqflite/**",
                    r"package:sentry_drift/**",
                    r"package:sentry_hive/**",
                    r"package:sentry_isar/**",
                    r"package:sentry_link/**",
                    r"package:sentry_firebase_remote_config/**",
                    # obfuscated builds
                    r"/**/.pub-cache/**/sentry**",
                },
                path_replacer=KeepFieldPathReplacer(fields={"package", "filename", "abs_path"}),
            ),
            sdk_crash_ignore_matchers={
                # getCurrentStackTrace is always part of the stacktrace when the SDK captures the stacktrace,
                # and would cause false positives. Therefore, we ignore it.
                FunctionAndModulePattern(
                    module_pattern="*",
                    function_pattern="getCurrentStackTrace",
                ),
                # Ignore handleDrawFrame and handleBeginFrame to avoid false positives.
                # In the Sentry Flutter SDK, we override the handleDrawFrame and handleBeginFrame methods,
                # add our custom implementation on top to instrument frame tracking and then forward the calls to Flutter.
                # However every custom implementation is try/catch guarded so no exception can be thrown.
                FunctionAndModulePattern(
                    module_pattern="*",
                    function_pattern="SentryWidgetsBindingMixin.handleDrawFrame",
                ),
                FunctionAndModulePattern(
                    module_pattern="*",
                    function_pattern="SentryWidgetsBindingMixin.handleBeginFrame",
                ),
                # This is the integration responsible for reporting unhandled errors.
                # For certain errors the frame is sometimes included in the stacktrace which leads to false positives.
                FunctionAndModulePattern(
                    module_pattern="*",
                    function_pattern="FlutterErrorIntegration.call.<fn>",
                ),
            },
        )
        configs.append(dart_config)

    dotnet_options = _get_options(sdk_name=SdkName.Dotnet, has_organization_allowlist=True)

    if dotnet_options:
        # Unity SDK contains .NET SDK, so the versions must match. 0.24.0 Unity release was
        # based on 3.22.0 .NET release. From that point on SDK names and frames should be consistent.
        dotnet_min_sdk_version = "3.22.0"
        unity_min_sdk_version = "0.24.0"

        dotnet_config = SDKCrashDetectionConfig(
            sdk_name=SdkName.Dotnet,
            project_id=dotnet_options["project_id"],
            sample_rate=dotnet_options["sample_rate"],
            organization_allowlist=dotnet_options["organization_allowlist"],
            sdk_names={
                "sentry.dotnet": dotnet_min_sdk_version,
                "sentry.dotnet.android": dotnet_min_sdk_version,
                "sentry.dotnet.aspnet": dotnet_min_sdk_version,
                "sentry.dotnet.aspnetcore": dotnet_min_sdk_version,
                "sentry.dotnet.aspnetcore.grpc": dotnet_min_sdk_version,
                "sentry.dotnet.cocoa": dotnet_min_sdk_version,
                "sentry.dotnet.ef": dotnet_min_sdk_version,
                "sentry.dotnet.extensions.logging": dotnet_min_sdk_version,
                "sentry.dotnet.google-cloud-function": dotnet_min_sdk_version,
                "sentry.dotnet.log4net": dotnet_min_sdk_version,
                "sentry.dotnet.maui": dotnet_min_sdk_version,
                "sentry.dotnet.nlog": dotnet_min_sdk_version,
                "sentry.dotnet.serilog": dotnet_min_sdk_version,
                "sentry.dotnet.xamarin": dotnet_min_sdk_version,
                "sentry.dotnet.xamarin-forms": dotnet_min_sdk_version,
                "sentry.dotnet.unity": unity_min_sdk_version,
                "sentry.unity": unity_min_sdk_version,
                "sentry.unity.lite": unity_min_sdk_version,
            },
            # Report fatal errors, since there are no crashes in Unity
            report_fatal_errors=True,
            ignore_mechanism_type=set(),
            allow_mechanism_type=set(),
            system_library_path_patterns={
                # .NET System libraries
                r"System.**",
                r"Microsoft.**",
                r"mscorlib**",
                r"netstandard**",
                # Unity engine libraries
                r"UnityEngine.**",
                r"UnityEditor.**",
                # Common .NET Core/Framework paths
                r"**.NETCoreApp**",
                r"**.NETFramework**",
                r"**.NETStandard**",
            },
            sdk_frame_config=SDKFrameConfig(
                function_patterns=set(),
                path_patterns={
                    # Main Sentry .NET SDK modules
                    r"Sentry.**",
                    # Unity-specific Sentry paths (for cases where abs_path is available)
                    r"**/sentry-unity/**",
                    r"**/sentry-dotnet/**",
                },
                path_replacer=KeepFieldPathReplacer(fields={"module", "package", "filename"}),
            ),
            sdk_crash_ignore_matchers={
                FunctionAndModulePattern(
                    module_pattern="Sentry.Samples.**",
                    function_pattern="*",
                ),
            },
        )
        configs.append(dotnet_config)

    return configs


def _get_options(
    sdk_name: SdkName, has_organization_allowlist: bool
) -> SDKCrashDetectionOptions | None:
    options_prefix = f"issues.sdk_crash_detection.{sdk_name.value}"

    project_id = options.get(f"{options_prefix}.project_id")
    if not project_id:
        return None

    sample_rate = options.get(f"{options_prefix}.sample_rate")
    if not sample_rate:
        return None

    organization_allowlist: list[int] = []
    if has_organization_allowlist:
        organization_allowlist = options.get(f"{options_prefix}.organization_allowlist")

    return SDKCrashDetectionOptions(
        project_id=project_id,
        sample_rate=sample_rate,
        organization_allowlist=organization_allowlist,
    )
