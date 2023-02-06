from typing import Any, Mapping

import pytest

from sentry.utils.sdk_crashes.sdk_crash_detection import is_sdk_crash


@pytest.mark.parametrize(
    "function,expected",
    [
        ("-[SentryHub getScope]", True),
        ("-[sentryisgreat]", True),
        ("-[SentryCrash crash]", True),
        ("-[SenryHub getScope]", False),
        ("-SentryHub getScope]", False),
        ("-[SomeSentryHub getScope]", False),
    ],
)
def test_sdk_crash_detection(function, expected):
    frames = [
        {
            "function": "__49-[UINavigationController _startCustomTransition:]_block_invoke",
            "symbol": "__49-[UINavigationController _startCustomTransition:]_block_invoke",
            "package": "UIKitCore",
            "in_app": False,
            "image_addr": "0x1b6568000",
            "instruction_addr": "0x1b676a1a8",
            "symbol_addr": "0x1b676a0dc",
        },
        {
            "function": "-[UINavigationController navigationTransitionView:didEndTransition:fromView:toView:]",
            "symbol": "-[UINavigationController navigationTransitionView:didEndTransition:fromView:toView:]",
            "package": "UIKitCore",
            "in_app": False,
            "data": {"symbolicator_status": "symbolicated"},
            "image_addr": "0x1b6568000",
            "instruction_addr": "0x1b66b8238",
            "symbol_addr": "0x1b66b7d90",
        },
        {
            "function": "-[UIViewController _endAppearanceTransition:]",
            "symbol": "-[UIViewController _endAppearanceTransition:]",
            "package": "UIKitCore",
            "in_app": False,
            "image_addr": "0x1b6568000",
            "instruction_addr": "0x1b678d344",
            "symbol_addr": "0x1b678d270",
        },
        {
            "function": "-[UIViewController __viewDidAppear:]",
            "symbol": "-[UIViewController __viewDidAppear:]",
            "package": "UIKitCore",
            "in_app": False,
            "image_addr": "0x1b6568000",
            "instruction_addr": "0x1b678d4c8",
            "symbol_addr": "0x1b678d428",
        },
        {
            "function": "-[UIViewController _setViewAppearState:isAnimating:]",
            "symbol": "-[UIViewController _setViewAppearState:isAnimating:]",
            "package": "UIKitCore",
            "in_app": False,
            "image_addr": "0x1b6568000",
            "instruction_addr": "0x1b6574ef0",
            "symbol_addr": "0x1b6574a78",
        },
        {
            "function": "LoginViewController.viewDidAppear",
            "raw_function": "@objc LoginViewController.viewDidAppear(Bool)",
            "symbol": "$s8Sentry9LoginViewControllerC13viewDidAppearyySbFTo",
            "package": "SentryApp",
            "filename": "<compiler-generated>",
            "abs_path": "<compiler-generated>",
            "in_app": True,
            "image_addr": "0x1025e8000",
            "instruction_addr": "0x102b16798",
            "symbol_addr": "0x1025e8000",
        },
        {
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
        },
        {
            "function": "__47-[SentryBreadcrumbTracker swizzleViewDidAppear]_block_invoke_2",
            "symbol": "__47-[SentryBreadcrumbTracker swizzleViewDidAppear]_block_invoke_2",
            "package": "Sentry",
            "filename": "SentryBreadcrumbTracker.m",
            "abs_path": "/Users/vagrant/git/iOS/Carthage/Checkouts/sentry-cocoa/Sources/Sentry/SentryBreadcrumbTracker.m",
            "lineno": 145,
            "in_app": True,
            "image_addr": "0x1055dc000",
            "instruction_addr": "0x1056054d0",
            "symbol_addr": "0x1056052e8",
        },
        create_sentry_frame(function),
    ]

    assert is_sdk_crash(frames) is expected


def test_is_sdk_crash_no_frames():
    assert is_sdk_crash([]) is False


def test_is_sdk_crash_single_frame():
    assert is_sdk_crash([create_sentry_frame("-[Sentry]")]) is True


def create_sentry_frame(function) -> Mapping[str, Any]:
    return {
        "function": function,
        "package": "Sentry",
        "filename": "SentryHub.m",
        "instruction_addr": 4295098388,
        "abs_path": "/Users/sentry/git/iOS/Carthage/Checkouts/sentry-cocoa/Sources/Sentry/SentryHub.m",
        "in_app:": False,
    }
