from typing import Any, Collection, Dict, Mapping, MutableMapping, Sequence

IN_APP_FRAME = {
    "function": "LoginViewController.viewDidAppear",
    "raw_function": "LoginViewController.viewDidAppear(Bool)",
    "symbol": "$s8Sentry9LoginViewControllerC13viewDidAppearyySbF",
    "package": "SentryApp",
    "filename": "LoginViewController.swift",
    "abs_path": "/Users/sentry/git/iOS/Sentry/LoggedOut/LoginViewController.swift",
    "lineno": 196,
    "in_app": True,
    "image_addr": "0x100260000",
    "instruction_addr": "0x102b16630",
    "symbol_addr": "0x100260000",
}


def get_sentry_frame(function: str, in_app: bool = False) -> MutableMapping[str, Any]:
    return {
        "function": function,
        "package": "/private/var/containers/Bundle/Application/59E988EF-46DB-4C75-8E08-10C27DC3E90E/iOS-Swift.app/Frameworks/Sentry.framework/Sentry",
        "in_app": in_app,
        "image_addr": "0x100304000",
    }


def get_frames(
    function: str, sentry_frame_in_app: bool = False
) -> Sequence[MutableMapping[str, Any]]:
    frames = [
        get_sentry_frame(function, sentry_frame_in_app),
        {
            "function": "LoginViewController.viewDidAppear",
            "symbol": "$s8Sentry9LoginViewControllerC13viewDidAppearyySbF",
            "package": "/private/var/containers/Bundle/Application/D9118D4F-E47F-47D3-96A2-35E854245CB4/iOS-Swift.app/iOS-Swift",
            "in_app": True,
            "filename": "LoginViewController.swift",
            "image_addr": "0x100260000",
        },
        get_sentry_frame(
            "__49-[SentrySwizzleWrapper swizzleSendAction:forKey:]_block_invoke_2", False
        ),
        IN_APP_FRAME,
        {
            "function": "-[UIViewController _setViewAppearState:isAnimating:]",
            "symbol": "-[UIViewController _setViewAppearState:isAnimating:]",
            "package": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
            "in_app": False,
            "image_addr": "0x1a4e8f000",
        },
        {
            "function": "-[UIViewController __viewDidAppear:]",
            "symbol": "-[UIViewController __viewDidAppear:]",
            "package": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
            "in_app": False,
            "image_addr": "0x1a4e8f000",
        },
        {
            "function": "-[UIViewController _endAppearanceTransition:]",
            "symbol": "-[UIViewController _endAppearanceTransition:]",
            "package": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
            "in_app": False,
            "image_addr": "0x1a4e8f000",
        },
        {
            "function": "-[UINavigationController navigationTransitionView:didEndTransition:fromView:toView:]",
            "symbol": "-[UINavigationController navigationTransitionView:didEndTransition:fromView:toView:]",
            "package": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
            "in_app": False,
            "image_addr": "0x1a4e8f000",
        },
        {
            "function": "__49-[UINavigationController _startCustomTransition:]_block_invoke",
            "symbol": "__49-[UINavigationController _startCustomTransition:]_block_invoke",
            "package": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
            "in_app": False,
            "image_addr": "0x1a4e8f000",
        },
        {
            "filename": "EventStripperTestFrame.swift",
            "function": "function",
            "raw_function": "raw_function",
            "module": "module",
            "abs_path": "abs_path",
            "in_app": False,
            "instruction_addr": "0x1a4e8f000",
            "addr_mode": "0x1a4e8f000",
            "symbol": "symbol",
            "symbol_addr": "0x1a4e8f000",
            "image_addr": "0x1a4e8f000",
            "package": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
            "platform": "platform",
            "post_context": ["should_be_removed"],
        },
    ]

    # The frames have to be ordered from caller to callee, or oldest to youngest.
    # The last frame is the one creating the exception.
    # As we usually look at stacktraces from youngest to oldest, we reverse the order.
    return frames[::-1]


def get_crash_event(handled=False, function="-[Sentry]", **kwargs) -> Dict[str, Collection[str]]:
    return get_crash_event_with_frames(get_frames(function), handled=handled, **kwargs)


def get_crash_event_with_frames(
    frames: Sequence[Mapping[str, Any]], handled=False, **kwargs
) -> Dict[str, Collection[str]]:
    result = {
        "event_id": "80e3496eff734ab0ac993167aaa0d1cd",
        "release": "5.222.5",
        "type": "error",
        "level": "fatal",
        "platform": "cocoa",
        "tags": {"level": "fatal"},
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": frames,
                    },
                    "type": "EXC_BAD_ACCESS",
                    "value": "crash > crash: > objectAtIndex: >\nAttempted to dereference null pointer.",
                    "mechanism": {
                        "handled": handled,
                        "type": "mach",
                        "meta": {
                            "signal": {
                                "number": 11,
                                "code": 0,
                                "name": "SIGSEGV",
                                "code_name": "SEGV_NOOP",
                            },
                            "mach_exception": {
                                "exception": 1,
                                "code": 1,
                                "subcode": 0,
                                "name": "EXC_BAD_ACCESS",
                            },
                        },
                    },
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
                "simulator": True,
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
        "debug_meta": {
            "images": [
                {
                    "code_file": "/private/var/containers/Bundle/Application/895DA2DE-5FE3-44A0-8C0F-900519EA5516/iOS-Swift.app/iOS-Swift",
                    "debug_id": "aa8a3697-c88a-36f9-a687-3d3596568c8d",
                    "arch": "arm64",
                    "image_addr": "0x100260000",
                    "image_size": 180224,
                    "image_vmaddr": "0x100000000",
                    "type": "macho",
                },
                {
                    "code_file": "/private/var/containers/Bundle/Application/9EB557CD-D653-4F51-BFCE-AECE691D4347/iOS-Swift.app/Frameworks/Sentry.framework/Sentry",
                    "debug_id": "e2623c4d-79c5-3cdf-90ab-2cf44e026bdd",
                    "arch": "arm64",
                    "image_addr": "0x100304000",
                    "image_size": 802816,
                    "type": "macho",
                },
                {
                    "code_file": "/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore",
                    "debug_id": "b0858d8e-7220-37bf-873f-ecc2b0a358c3",
                    "arch": "arm64e",
                    "image_addr": "0x1a4e8f000",
                    "image_size": 25309184,
                    "image_vmaddr": "0x188ff7000",
                    "type": "macho",
                },
                {
                    "code_file": "/System/Library/Frameworks/CFNetwork.framework/CFNetwork",
                    "debug_id": "b2273be9-538a-3f56-b9c7-801f39550f58",
                    "arch": "arm64e",
                    "image_addr": "0x1a3e32000",
                    "image_size": 3977216,
                    "image_vmaddr": "0x187f9a000",
                    "in_app": False,
                    "type": "macho",
                },
            ]
        },
        "environment": "test-app",
        "sdk": {
            "name": "sentry.cocoa",
            "version": "8.2.0",
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
