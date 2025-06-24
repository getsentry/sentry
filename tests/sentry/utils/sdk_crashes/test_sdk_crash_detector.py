import pytest

from sentry.utils.sdk_crashes.sdk_crash_detection_config import FunctionAndModulePattern
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


@pytest.mark.parametrize("field_containing_path", ["package", "module", "abs_path", "filename"])
def test_build_sdk_crash_detection_configs(empty_cocoa_config, field_containing_path):

    empty_cocoa_config.sdk_frame_config.path_patterns = {"Sentry**"}

    detector = SDKCrashDetector(empty_cocoa_config)

    frame = {
        field_containing_path: "Sentry",
    }

    assert detector.is_sdk_frame(frame) is True


@pytest.mark.parametrize(
    "test_id,ignore_matchers,frames,is_crash,description",
    [
        (
            "function_module_match",
            [
                FunctionAndModulePattern(
                    module_pattern="kotlin.coroutines", function_pattern="invoke"
                )
            ],
            [{"function": "invoke", "module": "kotlin.coroutines", "package": "MyApp"}],
            False,
            "Should not report a crash when both module and function match pattern exactly",
        ),
        (
            "function_match_module_wildcard",
            [FunctionAndModulePattern(module_pattern="*", function_pattern="getCurrentStackTrace")],
            [{"function": "getCurrentStackTrace", "module": "some.module", "package": "MyApp"}],
            False,
            "Should not report a crash when function matches and module pattern is wildcard",
        ),
        (
            "function_match_module_wildcard_module_is_none",
            [FunctionAndModulePattern(module_pattern="*", function_pattern="getCurrentStackTrace")],
            [{"function": "getCurrentStackTrace", "package": "MyApp"}],
            False,
            "Should not report a crash when function matches and module pattern is wildcard, even when frames[0].module is None",
        ),
        (
            "function_mismatch_module_wildcard",
            [FunctionAndModulePattern(module_pattern="*", function_pattern="getCurrentStackTrace")],
            [{"function": "someOtherFunction", "module": "some.module", "package": "MyApp"}],
            True,
            "Should report a crash when module pattern is wildcard but function doesn't match",
        ),
        (
            "function_wildcard_module_match",
            [FunctionAndModulePattern(module_pattern="test.module", function_pattern="*")],
            [{"function": "anyFunction", "module": "test.module", "package": "MyApp"}],
            False,
            "Should not report a crash when function pattern is wildcard and module matches",
        ),
        (
            "function_wildcard_module_mismatch",
            [FunctionAndModulePattern(module_pattern="test.module", function_pattern="*")],
            [{"function": "anyFunction", "module": "other.module", "package": "MyApp"}],
            True,
            "Should report a crash when function pattern is wildcard but module doesn't match",
        ),
    ],
)
def test_sdk_crash_ignore_matchers(
    empty_cocoa_config, test_id, ignore_matchers, frames, is_crash, description
):
    empty_cocoa_config.sdk_crash_ignore_matchers = set(ignore_matchers)
    empty_cocoa_config.sdk_frame_config.path_patterns = {"**"}

    detector = SDKCrashDetector(empty_cocoa_config)

    assert detector.is_sdk_crash(frames) is is_crash, description
