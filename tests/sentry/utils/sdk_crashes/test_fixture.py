from typing import Any, Mapping, Sequence

IN_APP_FRAME = {
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


def get_sentry_frame(function: str, in_app: bool = False) -> Mapping[str, Any]:
    return {
        "function": function,
        "package": "Sentry",
        "in_app": in_app,
    }


def get_frames(function: str, sentry_frame_in_app: bool = False) -> Sequence[Mapping[str, Any]]:
    return [
        get_sentry_frame(function, sentry_frame_in_app),
        {
            "function": "LoginViewController.viewDidAppear",
            "symbol": "$s8Sentry9LoginViewControllerC13viewDidAppearyySbF",
            "package": "SentryApp",
            "filename": "LoginViewController.swift",
        },
        IN_APP_FRAME,
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


def get_crash_event(handled=False, function="-[Sentry]", **kwargs) -> Sequence[Mapping[str, Any]]:
    return get_crash_event_with_frames(get_frames(function), handled=handled, **kwargs)


def get_crash_event_with_frames(
    frames: Sequence[Mapping[str, Any]], handled=False, **kwargs
) -> Sequence[Mapping[str, Any]]:
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
                        "frames": frames,
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
        "logger": "my.logger.name",
    }
    result.update(kwargs)
    return result
