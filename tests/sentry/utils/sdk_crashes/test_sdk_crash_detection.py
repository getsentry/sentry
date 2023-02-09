from typing import Any, Mapping

import pytest

from sentry.utils.sdk_crashes.sdk_crash_detection import (
    detect_sdk_crash,
    is_cocoa_sdk_crash,
    strip_frames,
)

in_app_frame = {
    "function": "LoginViewController.viewDidAppear",
    "raw_function": "LoginViewController.viewDidAppear(Bool)",
    "symbol": "$s8Sentry9LoginViewControllerC13viewDidAppearyySbF",
    "package": "SentryApp",
    "filename": "LoginViewController.swift",
    "abs_path": "/Users/sentry/git/iOS/Sentry/LoggedOut/LoginViewController.swift",
    "lineno": 196,
    "in_app": True,
    "image_addr": "0x1025e8000",
    "instruction_addr": "0x102b16630",
    "symbol_addr": "0x1025e8000",
}


def make_crash_event(handled=False, function="-[Sentry]", **kwargs):
    result = {
        "event_id": "80e3496eff734ab0ac993167aaa0d1cd",
        "project": 5218188,
        "release": "5.222.5",
        "type": "error",
        "level": "fatal",
        "platform": "cocoa",
        "tags": {"level": "fatal"},
        "datetime": "2023-02-08T23:51:35.000000Z",
        "timestamp": 1675936223.0,
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {
                                "function": function,
                                "package": "Sentry",
                                "in_app:": False,
                            }
                        ],
                    },
                    "type": "SIGABRT",
                    "mechanism": {"handled": handled},
                }
            ]
        },
        "breadcrumbs": {
            "values": [
                {
                    "timestamp": 1675900265.0,
                    "type": "debug",
                    "category": "started",
                    "level": "info",
                    "message": "Breadcrumb Tracking",
                },
            ]
        },
        "contexts": {
            "app": {
                "app_start_time": "2023-02-08T23:51:05Z",
                "device_app_hash": "8854fe9e3d4e4a66493baee798bfae0228efabf1",
                "build_type": "app store",
                "app_identifier": "com.some.company.io",
                "app_name": "SomeCompany",
                "app_version": "5.222.5",
                "app_build": "21036",
                "app_id": "397D4F75-6C01-32D1-BF46-62098979E470",
                "type": "app",
            },
            "device": {
                "family": "iOS",
                "model": "iPhone14,8",
                "model_id": "D28AP",
                "arch": "arm64e",
                "memory_size": 5944508416,
                "free_memory": 102154240,
                "usable_memory": 4125687808,
                "storage_size": 127854202880,
                "boot_time": "2023-02-01T05:21:23Z",
                "timezone": "PST",
                "type": "device",
            },
            "os": {
                "name": "iOS",
                "version": "16.3",
                "build": "20D47",
                "kernel_version": "Darwin Kernel Version 22.3.0: Wed Jan  4 21:25:19 PST 2023; root:xnu-8792.82.2~1/RELEASE_ARM64_T8110",
                "rooted": False,
                "type": "os",
            },
        },
        # Todo add referenced in stacktrace
        "debug_meta": {
            "images": [
                {
                    "name": "CrashProbeiOS",
                    "image_vmaddr": "0x0000000100000000",
                    "image_addr": "0x0000000100088000",
                    "type": "apple",
                    "image_size": 65536,
                    "uuid": "2C656702-AA16-3E5F-94D9-D4430DA53398",
                },
            ]
        },
        "environment": "test-app",
        "sdk": {
            "name": "sentry.cocoa",
            "version": "8.1.0",
            "integrations": [
                "Crash",
                "PerformanceTracking",
                "MetricKit",
                "WatchdogTerminationTracking",
                "ViewHierarchy",
                "NetworkTracking",
                "ANRTracking",
                "AutoBreadcrumbTracking",
                "FramesTracking",
                "AppStartTracking",
                "Screenshot",
                "FileIOTracking",
                "UIEventTracking",
                "AutoSessionTracking",
                "CoreDataTracking",
                "PreWarmedAppStartTracing",
            ],
        },
        "threads": {
            "values": [
                {
                    "id": 0,
                    "stacktrace": {
                        "frames": [
                            {
                                "function": "<redacted>",
                                "in_app": False,
                                "data": {"symbolicator_status": "unknown_image"},
                                "image_addr": "0x0",
                                "instruction_addr": "0x1129be52e",
                                "symbol_addr": "0x0",
                            },
                            {
                                "function": "<redacted>",
                                "in_app": False,
                                "data": {"symbolicator_status": "unknown_image"},
                                "image_addr": "0x0",
                                "instruction_addr": "0x104405f21",
                                "symbol_addr": "0x0",
                            },
                        ],
                    },
                    "raw_stacktrace": {
                        "frames": [
                            {
                                "function": "<redacted>",
                                "in_app": False,
                                "image_addr": "0x0",
                                "instruction_addr": "0x1129be52e",
                                "symbol_addr": "0x0",
                            },
                            {
                                "function": "<redacted>",
                                "in_app": False,
                                "image_addr": "0x0",
                                "instruction_addr": "0x104405f21",
                                "symbol_addr": "0x0",
                            },
                        ],
                    },
                    "crashed": True,
                }
            ]
        },
        "user": {
            "id": "803F5C87-0F8B-41C7-8499-27BD71A92738",
            "ip_address": "192.168.0.1",
            "geo": {"country_code": "US", "region": "United States"},
        },
    }
    result.update(kwargs)
    return result


@pytest.mark.parametrize(
    "data,expected",
    [
        (
            make_crash_event(),
            True,
        ),
        (
            make_crash_event(handled=True),
            False,
        ),
        (make_crash_event(function="Senry"), False),
        (make_crash_event(platform="coco"), False),
        (make_crash_event(type="erro"), False),
        (make_crash_event(exception=[]), False),
    ],
    ids=[
        "unhandled_is_detected",
        "handled_not_detected",
        "wrong_function_not_detected",
        "wrong_platform_not_detected",
        "wrong_type_not_detected",
        "no_exception_not_detected",
    ],
)
def test_detect_sdk_crash(data, expected):
    assert detect_sdk_crash(data) is expected


@pytest.mark.parametrize(
    "function,expected",
    [
        ("-[SentryHub getScope]", True),
        ("sentrycrashdl_getBinaryImage", True),
        ("-[sentryisgreat]", True),
        ("__47-[SentryBreadcrumbTracker swizzleViewDidAppear]_block_invoke_2", True),
        ("-[SentryCrash crash]", True),
        ("-[SenryHub getScope]", False),
        ("-SentryHub getScope]", False),
        ("-[SomeSentryHub getScope]", False),
        ("+[SentrySDK crash]", False),
    ],
)
def test_cocoa_sdk_crash_detection(function, expected):
    frames = get_frames(function)

    assert is_cocoa_sdk_crash(frames) is expected


def test_is_cocoa_sdk_crash_only_non_inapp_after_sentry_frame():
    frames = [
        {
            "function": "__handleUncaughtException",
            "symbol": "__handleUncaughtException",
            "package": "CoreFoundation",
            "in_app": False,
        },
        {
            "function": "_objc_terminate",
            "symbol": "_ZL15_objc_terminatev",
            "package": "libobjc.A.dylib",
            "in_app": False,
        },
        create_sentry_frame("sentrycrashdl_getBinaryImage"),
        {
            "function": "std::__terminate",
            "symbol": "_ZSt11__terminatePFvvE",
            "package": "libc++abi.dylib",
            "in_app": False,
        },
    ]

    assert is_cocoa_sdk_crash(frames) is True


def test_is_cocoa_sdk_crash_only_inapp_after_sentry_frame():
    frames = [
        in_app_frame,
        {
            "function": "__handleUncaughtException",
            "symbol": "__handleUncaughtException",
            "package": "CoreFoundation",
            "in_app": False,
        },
        {
            "function": "_objc_terminate",
            "symbol": "_ZL15_objc_terminatev",
            "package": "libobjc.A.dylib",
            "in_app": False,
        },
        create_sentry_frame("sentrycrashdl_getBinaryImage"),
        {
            "function": "std::__terminate",
            "symbol": "_ZSt11__terminatePFvvE",
            "package": "libc++abi.dylib",
            "in_app": False,
        },
    ]

    assert is_cocoa_sdk_crash(frames) is False


@pytest.mark.parametrize(
    "filename,expected",
    [
        ("SentryCrashMonitor_CPPException.cpp", True),
        ("SentryMonitor_CPPException.cpp", True),
        ("SentrMonitor_CPPException.cpp", False),
    ],
)
def test_is_cocoa_sdk_crash_filename(filename, expected):
    frames = [
        {
            "function": "__handleUncaughtException",
            "symbol": "__handleUncaughtException",
            "package": "CoreFoundation",
            "in_app": False,
        },
        {
            "function": "_objc_terminate",
            "symbol": "_ZL15_objc_terminatev",
            "package": "libobjc.A.dylib",
            "in_app": False,
        },
        {
            "function": "CPPExceptionTerminate",
            "raw_function": "CPPExceptionTerminate()",
            "filename": filename,
            "symbol": "_ZL21CPPExceptionTerminatev",
            "package": "MainApp",
            "in_app": False,
        },
        {
            "function": "std::__terminate",
            "symbol": "_ZSt11__terminatePFvvE",
            "package": "libc++abi.dylib",
            "in_app": False,
        },
    ]

    assert is_cocoa_sdk_crash(frames) is expected


def test_is_cocoa_sdk_crash_no_frames():
    assert is_cocoa_sdk_crash([]) is False


def test_is_cocoa_sdk_crash_empty_frames():
    assert is_cocoa_sdk_crash([{"empty": "frame"}]) is False


def test_is_cocoa_sdk_crash_single_frame():
    assert is_cocoa_sdk_crash([create_sentry_frame("-[Sentry]")]) is True


def test_is_cocoa_sdk_crash_single_in_app_frame():
    assert is_cocoa_sdk_crash([create_sentry_frame("-[Sentry]", in_app=True)]) is True


def test_strip_frames_removes_in_app():
    frames = get_frames("sentrycrashdl_getBinaryImage")

    stripped_frames = strip_frames(frames)
    assert len(stripped_frames) == 6
    assert (
        len([frame for frame in stripped_frames if frame["function"] == in_app_frame["function"]])
        == 0
    ), "in_app frame should be removed"


@pytest.mark.parametrize(
    "function,in_app",
    [
        ("SentryCrashMonitor_CPPException.cpp", True),
        ("SentryCrashMonitor_CPPException.cpp", False),
        ("sentr", False),
    ],
    ids=["sentry_in_app_frame_kept", "sentry_not_in_app_frame_kept", "non_sentry_non_in_app_kept"],
)
def test_strip_frames(function, in_app):
    frames = get_frames(function, sentry_frame_in_app=in_app)

    stripped_frames = strip_frames(frames)

    assert len(stripped_frames) == 6
    assert (
        len([frame for frame in stripped_frames if frame["function"] == in_app_frame["function"]])
        == 0
    ), "in_app frame should be removed"


def create_sentry_frame(function, in_app: bool = False) -> Mapping[str, Any]:
    return {
        "function": function,
        "package": "Sentry",
        "in_app": in_app,
    }


def get_frames(function: str, sentry_frame_in_app: bool = False):
    return [
        create_sentry_frame(function, sentry_frame_in_app),
        {
            "function": "LoginViewController.viewDidAppear",
            "symbol": "$s8Sentry9LoginViewControllerC13viewDidAppearyySbF",
            "package": "SentryApp",
            "filename": "LoginViewController.swift",
        },
        in_app_frame,
        {
            "function": "-[UIViewController _setViewAppearState:isAnimating:]",
            "symbol": "-[UIViewController _setViewAppearState:isAnimating:]",
            "package": "UIKitCore",
            "in_app": False,
        },
        {
            "function": "-[UIViewController __viewDidAppear:]",
            "symbol": "-[UIViewController __viewDidAppear:]",
            "package": "UIKitCore",
            "in_app": False,
        },
        {
            "function": "-[UIViewController _endAppearanceTransition:]",
            "symbol": "-[UIViewController _endAppearanceTransition:]",
            "package": "UIKitCore",
            "in_app": False,
        },
        {
            "function": "-[UINavigationController navigationTransitionView:didEndTransition:fromView:toView:]",
            "symbol": "-[UINavigationController navigationTransitionView:didEndTransition:fromView:toView:]",
            "package": "UIKitCore",
            "in_app": False,
        },
        {
            "function": "__49-[UINavigationController _startCustomTransition:]_block_invoke",
            "symbol": "__49-[UINavigationController _startCustomTransition:]_block_invoke",
            "package": "UIKitCore",
            "in_app": False,
        },
    ]
