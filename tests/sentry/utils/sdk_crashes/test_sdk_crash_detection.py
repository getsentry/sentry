from typing import Any, Mapping

import pytest

from sentry.utils.sdk_crashes.sdk_crash_detection import is_sdk_crash

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
def test_sdk_crash_detection(function, expected):
    frames = [
        {
            "function": "__49-[UINavigationController _startCustomTransition:]_block_invoke",
            "symbol": "__49-[UINavigationController _startCustomTransition:]_block_invoke",
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
            "function": "-[UIViewController _endAppearanceTransition:]",
            "symbol": "-[UIViewController _endAppearanceTransition:]",
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
            "function": "-[UIViewController _setViewAppearState:isAnimating:]",
            "symbol": "-[UIViewController _setViewAppearState:isAnimating:]",
            "package": "UIKitCore",
            "in_app": False,
        },
        in_app_frame,
        {
            "function": "LoginViewController.viewDidAppear",
            "symbol": "$s8Sentry9LoginViewControllerC13viewDidAppearyySbF",
            "package": "SentryApp",
            "filename": "LoginViewController.swift",
            "lineno": 196,
            "in_app": True,
        },
        create_sentry_frame(function),
    ]

    assert is_sdk_crash(frames) is expected


def test_is_sdk_crash_only_non_inapp_after_sentry_frame():
    frames = [
        {
            "function": "std::__terminate",
            "symbol": "_ZSt11__terminatePFvvE",
            "package": "libc++abi.dylib",
            "in_app": False,
        },
        create_sentry_frame("sentrycrashdl_getBinaryImage"),
        {
            "function": "_objc_terminate",
            "symbol": "_ZL15_objc_terminatev",
            "package": "libobjc.A.dylib",
            "in_app": False,
        },
        {
            "function": "__handleUncaughtException",
            "symbol": "__handleUncaughtException",
            "package": "CoreFoundation",
            "in_app": False,
        },
    ]

    assert is_sdk_crash(frames) is True


def test_is_sdk_crash_only_inapp_after_sentry_frame():
    frames = [
        {
            "function": "std::__terminate",
            "symbol": "_ZSt11__terminatePFvvE",
            "package": "libc++abi.dylib",
            "in_app": False,
        },
        create_sentry_frame("sentrycrashdl_getBinaryImage"),
        {
            "function": "_objc_terminate",
            "symbol": "_ZL15_objc_terminatev",
            "package": "libobjc.A.dylib",
            "in_app": False,
        },
        {
            "function": "__handleUncaughtException",
            "symbol": "__handleUncaughtException",
            "package": "CoreFoundation",
            "in_app": False,
        },
        in_app_frame,
    ]

    assert is_sdk_crash(frames) is False


@pytest.mark.parametrize(
    "filename,expected",
    [
        ("SentryCrashMonitor_CPPException.cpp", True),
        ("SentryMonitor_CPPException.cpp", True),
        ("SentrMonitor_CPPException.cpp", False),
    ],
)
def test_is_sdk_crash_filename(filename, expected):
    frames = [
        {
            "function": "std::__terminate",
            "symbol": "_ZSt11__terminatePFvvE",
            "package": "libc++abi.dylib",
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
            "function": "_objc_terminate",
            "symbol": "_ZL15_objc_terminatev",
            "package": "libobjc.A.dylib",
            "in_app": False,
        },
        {
            "function": "__handleUncaughtException",
            "symbol": "__handleUncaughtException",
            "package": "CoreFoundation",
            "in_app": False,
        },
    ]

    assert is_sdk_crash(frames) is expected


def test_is_sdk_crash_no_frames():
    assert is_sdk_crash([]) is False


def test_is_sdk_crash_empty_frames():
    assert is_sdk_crash([{"empty": "frame"}]) is False


def test_is_sdk_crash_single_frame():
    assert is_sdk_crash([create_sentry_frame("-[Sentry]")]) is True


def create_sentry_frame(function) -> Mapping[str, Any]:
    return {
        "function": function,
        "package": "Sentry",
        "in_app:": False,
    }
