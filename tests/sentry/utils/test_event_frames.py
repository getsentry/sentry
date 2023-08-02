import unittest

from sentry.testutils.cases import TestCase
from sentry.utils.event_frames import (
    cocoa_frame_munger,
    find_stack_frames,
    flutter_frame_munger,
    get_crashing_thread,
    get_sdk_name,
    munged_filename_and_frames,
    package_relative_path,
)
from sentry.utils.safe import get_path


class SdkNameTestCase(TestCase):
    def test_sdk_data_pathing(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Foo bar",
                "sdk": {"name": "sentry.javascript.react-native", "version": "1.2.3"},
            },
            project_id=self.project.id,
        )

        assert not get_sdk_name(None)
        assert event.data["sdk"]["name"] == "sentry.javascript.react-native"
        assert get_sdk_name(event.data) == "sentry.javascript.react-native"
        assert str(get_path(event.data, "sdk", "version", filter=True)) == "1.2.3"
        assert not get_path(event.data, "sdk", "does_not_exist", filter=True)

    def test_sdk_data_not_exist(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Foo bar",
            },
            project_id=self.project.id,
        )

        assert not get_sdk_name(event.data)


class CrashingThreadTestCase(unittest.TestCase):
    def test_return_none(self):
        assert not get_crashing_thread([])
        assert not get_crashing_thread(None)
        assert not get_crashing_thread([{}, {}, {}])
        assert not get_crashing_thread([{}])

    def test_single_crashed_thread(self):
        thread_frames = [{"id": 1, "crashed": True}, {"id": 2, "crashed": False}]
        assert get_crashing_thread(thread_frames) == thread_frames[0]

    def test_multiple_crashed_threads(self):
        thread_frames = [{"id": 1, "crashed": True}, {"id": 2, "crashed": True}]
        assert not get_crashing_thread(thread_frames)

    def test_single_current_thread(self):
        thread_frames = [{"id": 1, "current": True}, {"id": 2, "crashed": False}]
        assert get_crashing_thread(thread_frames) == thread_frames[0]

    def test_multiple_current_thread(self):
        thread_frames = [{"id": 1, "current": True}, {"id": 2, "current": True}]
        assert not get_crashing_thread(thread_frames)


class FilenameMungingTestCase(unittest.TestCase):
    def test_platform_other(self):
        fake_frame = [{"filename": "should_not_change.py"}]
        assert not munged_filename_and_frames("other", fake_frame)
        assert fake_frame[0]["filename"] == "should_not_change.py"

    def test_platform_sdk_name_not_supported(self):
        assert not munged_filename_and_frames("javascript", [], "munged", "sdk.other")

    def test_supported_platform_sdk_name_not_required(self):
        frames = [
            {
                "module": "jdk.internal.reflect.NativeMethodAccessorImpl",
                "filename": "NativeMethodAccessorImpl.java",
            }
        ]
        assert munged_filename_and_frames("java", frames, "munged")


class JavaFilenameMungingTestCase(unittest.TestCase):
    def test_platform_java(self):
        frames = [
            {
                "module": "jdk.internal.reflect.NativeMethodAccessorImpl",
                "filename": "NativeMethodAccessorImpl.java",
            },
            {
                "module": "io.sentry.example.Application",
                "filename": "Application.java",
            },
            {
                "module": "io.sentry.example.Application",
                "filename": "Application.java",
            },
        ]
        ret = munged_filename_and_frames("java", frames, "munged_filename")
        assert ret is not None
        key, munged_frames = ret
        assert len(munged_frames) == 3
        assert munged_frames[0][key] == "jdk/internal/reflect/NativeMethodAccessorImpl.java"
        assert munged_frames[1][key] == "io/sentry/example/Application.java"
        assert munged_frames[2][key] == "io/sentry/example/Application.java"
        for z in zip(frames, munged_frames):
            assert z[0].items() <= z[1].items()

    def test_platform_java_no_filename(self):
        no_filename = {
            "module": "io.sentry.example.Application",
        }
        no_munged = munged_filename_and_frames("java", [no_filename])
        assert not no_munged

    def test_platform_java_no_module(self):
        no_module = {
            "filename": "Application.java",
        }
        no_munged = munged_filename_and_frames("java", [no_module])
        assert not no_munged

    def test_platform_android_kotlin(self):
        exception_frames = [
            {
                "function": "main",
                "module": "com.android.internal.os.ZygoteInit",
                "filename": "ZygoteInit.java",
                "abs_path": "ZygoteInit.java",
                "lineno": 1003,
                "in_app": False,
            },
            {
                "function": "run",
                "module": "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
                "filename": "RuntimeInit.java",
                "abs_path": "RuntimeInit.java",
                "lineno": 548,
                "in_app": False,
            },
            {
                "function": "invoke",
                "module": "java.lang.reflect.Method",
                "filename": "Method.java",
                "abs_path": "Method.java",
                "in_app": False,
            },
            {
                "function": "main",
                "module": "android.app.ActivityThread",
                "filename": "ActivityThread.java",
                "abs_path": "ActivityThread.java",
                "lineno": 7842,
                "in_app": False,
            },
            {
                "function": "loop",
                "module": "android.os.Looper",
                "filename": "Looper.java",
                "abs_path": "Looper.java",
                "lineno": 288,
                "in_app": False,
            },
            {
                "function": "loopOnce",
                "module": "android.os.Looper",
                "filename": "Looper.java",
                "abs_path": "Looper.java",
                "lineno": 201,
                "in_app": False,
            },
            {
                "function": "dispatchMessage",
                "module": "android.os.Handler",
                "filename": "Handler.java",
                "abs_path": "Handler.java",
                "lineno": 99,
                "in_app": False,
            },
            {
                "function": "handleCallback",
                "module": "android.os.Handler",
                "filename": "Handler.java",
                "abs_path": "Handler.java",
                "lineno": 938,
                "in_app": False,
            },
            {
                "function": "run",
                "module": "android.view.View$PerformClick",
                "filename": "View.java",
                "abs_path": "View.java",
                "lineno": 28810,
                "in_app": False,
            },
            {
                "function": "access$3700",
                "module": "android.view.View",
                "filename": "View.java",
                "abs_path": "View.java",
                "lineno": 835,
                "in_app": False,
            },
            {
                "function": "performClickInternal",
                "module": "android.view.View",
                "filename": "View.java",
                "abs_path": "View.java",
                "lineno": 7432,
                "in_app": False,
            },
            {
                "function": "performClick",
                "module": "com.google.android.material.button.MaterialButton",
                "filename": "MaterialButton.java",
                "abs_path": "MaterialButton.java",
                "lineno": 1119,
                "in_app": False,
            },
            {
                "function": "performClick",
                "module": "android.view.View",
                "filename": "View.java",
                "abs_path": "View.java",
                "lineno": 7455,
                "in_app": False,
            },
            {
                "function": "onClick",
                "module": "com.jetbrains.kmm.androidApp.MainActivity$$ExternalSyntheticLambda0",
                "lineno": 2,
                "in_app": True,
            },
            {
                "function": "$r8$lambda$hGNRcN3pFcj8CSoYZBi9fT_AXd0",
                "module": "com.jetbrains.kmm.androidApp.MainActivity",
                "lineno": 0,
                "in_app": True,
            },
            {
                "function": "onCreate$lambda-1",
                "module": "com.jetbrains.kmm.androidApp.MainActivity",
                "filename": "MainActivity.kt",
                "abs_path": "MainActivity.kt",
                "lineno": 55,
                "in_app": True,
            },
        ]
        ret = munged_filename_and_frames("java", exception_frames, "munged_filename")
        assert ret is not None
        key, munged_frames = ret
        assert len(munged_frames) == 16
        for z in zip(exception_frames, munged_frames):
            assert z[0].items() <= z[1].items()

        has_munged = list(filter(lambda f: f.get("filename") and f.get("module"), munged_frames))
        assert len(has_munged) == 14
        assert all(x["munged_filename"].endswith(x["filename"]) for x in has_munged)


class CocoaFilenameMungingTestCase(unittest.TestCase):
    def test_simple(self):
        exception_frame = {
            "function": "main",
            "symbol": "main",
            "package": "SampleProject",
            "filename": "AppDelegate.swift",
            "abs_path": "/Users/gszeto/code/SwiftySampleProject/SampleProject/Classes/App Delegate/AppDelegate.swift",
            "lineno": 13,
            "in_app": True,
            "data": {"symbolicator_status": "symbolicated"},
            "image_addr": "0x102c90000",
            "instruction_addr": "0x102ce2bac",
            "symbol_addr": "0x102ce2b70",
        }

        did_munge = cocoa_frame_munger("munged_filename", exception_frame)
        assert did_munge
        assert (
            exception_frame["munged_filename"]
            == "SampleProject/Classes/App Delegate/AppDelegate.swift"
        )

    def test_missing_required_no_munging(self):
        assert cocoa_frame_munger(
            "munged_filename",
            {
                "package": "SampleProject",
                "abs_path": "SampleProject/AppDelegate.swift",
            },
        )

        assert not cocoa_frame_munger("munged_filename", {})
        assert not cocoa_frame_munger(
            "munged_filename",
            {
                "package": "SampleProject",
            },
        )
        assert not cocoa_frame_munger(
            "munged_filename",
            {
                "abs_path": "SampleProject/AppDelegate.swift",
            },
        )

    def test_package_relative_repeats(self):
        exception_frame = {
            "package": "SampleProject",
            "filename": "AppDelegate.swift",
            "abs_path": "/Users/gszeto/code/SampleProject/more/dirs/SwiftySampleProject/SampleProject/Classes/App Delegate/AppDelegate.swift",
        }

        did_munge = cocoa_frame_munger("munged_filename", exception_frame)
        assert did_munge
        assert (
            exception_frame["munged_filename"]
            == "SampleProject/more/dirs/SwiftySampleProject/SampleProject/Classes/App Delegate/AppDelegate.swift"
        )

    def test_path_relative(self):
        assert not package_relative_path("", "")
        assert not package_relative_path(None, None)
        assert package_relative_path("/a/b/c/d/e/file.txt", "/d/") == "d/e/file.txt"
        assert package_relative_path("/a/b/c/d/e/file.txt", "d") == "d/e/file.txt"
        assert (
            package_relative_path(
                "/Users/gszeto/code/SwiftySampleProject/SampleProject/Classes/App Delegate/AppDelegate.swift",
                "SampleProject",
            )
            == "SampleProject/Classes/App Delegate/AppDelegate.swift"
        )

        assert (
            package_relative_path(
                "/Users/denis/Repos/sentry/sentry-mobile/ios/Runner/AppDelegate.swift", "Runner"
            )
            == "Runner/AppDelegate.swift"
        )

        assert (
            package_relative_path("/one/two/three/four/three/two/one/file.txt", "one")
            == "one/two/three/four/three/two/one/file.txt"
        )


class ReactNativeFilenameMungingTestCase(TestCase):
    def test_not_munged(self):
        frames = [
            {
                "function": "callFunctionReturnFlushedQueue",
                "module": "react-native/Libraries/BatchedBridge/MessageQueue",
                "filename": "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
                "abs_path": "app:///node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
                "lineno": 115,
                "colno": 5,
                "in_app": False,
                "data": {"sourcemap": "app:///main.jsbundle.map"},
            },
            {"function": "apply", "filename": "native", "abs_path": "native", "in_app": True},
            {
                "function": "onPress",
                "module": "src/screens/EndToEndTestsScreen",
                "filename": "src/screens/EndToEndTestsScreen.tsx",
                "abs_path": "app:///src/screens/EndToEndTestsScreen.tsx",
                "lineno": 57,
                "colno": 11,
                "in_app": True,
                "data": {"sourcemap": "app:///main.jsbundle.map"},
            },
        ]

        munged_frames = munged_filename_and_frames(
            "javascript", frames, "munged_filename", "sentry.javascript.react-native"
        )
        assert not munged_frames


class FlutterFilenameMungingTestCase(TestCase):
    def test_not_munged(self):
        frames = [
            {
                "package": "my_package",
                "filename": "service.dart",
                "abs_path": "package:my_package/a/b/service.dart",
                "in_app": True,
            }
        ]
        munged_frames = munged_filename_and_frames("other", frames, "doesnt_matter", "sentry.sdk")
        assert not munged_frames

    def test_flutter_munger_supported(self):
        frames = [
            {
                "function": "tryCatchModule",
                "package": "sentry_flutter_example",
                "filename": "test.dart",
                "abs_path": "package:sentry_flutter_example/a/b/test.dart",
                "lineno": 8,
                "colno": 5,
                "in_app": True,
            }
        ]
        munged_frames = munged_filename_and_frames(
            "other", frames, "munged_filename", "sentry.dart.flutter"
        )
        assert munged_frames is not None
        munged_first_frame = munged_frames[1][0]
        assert munged_first_frame.items() > frames[0].items()
        assert munged_first_frame["munged_filename"] == "a/b/test.dart"

    def test_dart_prefix_not_munged(self):
        assert not flutter_frame_munger(
            "munged_filename",
            {
                "abs_path": "dart:ui/a/b/test.dart",
            },
        )

    def test_abs_path_not_present_not_munged(self):
        assert not flutter_frame_munger(
            "munged_filename",
            {
                "function": "tryCatchModule",
                "package": "sentry_flutter_example",
                "filename": "test.dart",
            },
        )

    def test_different_package_not_munged(self):
        assert not flutter_frame_munger(
            "munged_filename",
            {
                "package": "sentry_flutter_example",
                "abs_path": "package:different_package/a/b/test.dart",
            },
        )

    def test_no_package_not_munged(self):
        assert not flutter_frame_munger(
            "munged_filename",
            {
                "abs_path": "package:different_package/a/b/test.dart",
            },
        )


class CocoaWaterFallTestCase(TestCase):
    def test_crashing_event_with_exception_interface_but_no_frame_should_waterfall_to_thread_frames(
        self,
    ):
        event = self.store_event(
            data={
                "platform": "cocoa",
                "exception": {
                    "values": [
                        {
                            "type": "C++ Exception",
                            "value": "NSt3__112system_errorE",
                            "thread_id": 9,
                            "mechanism": {
                                "type": "cpp_exception",
                                "handled": False,
                                "meta": {
                                    "signal": {"number": 6, "code": 0, "name": "SIGABRT"},
                                    "mach_exception": {
                                        "exception": 10,
                                        "code": 0,
                                        "subcode": 0,
                                        "name": "EXC_CRASH",
                                    },
                                },
                            },
                        }
                    ]
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
                                        "instruction_addr": "0x1028d5aa4",
                                        "symbol_addr": "0x0",
                                    },
                                    {
                                        "function": "main",
                                        "symbol": "main",
                                        "package": "Runner",
                                        "filename": "AppDelegate.swift",
                                        "abs_path": "/Users/denis/Repos/sentry/sentry-mobile/ios/Runner/AppDelegate.swift",
                                        "lineno": 5,
                                        "in_app": True,
                                        "data": {"symbolicator_status": "symbolicated"},
                                        "image_addr": "0x102684000",
                                        "instruction_addr": "0x10268ab9c",
                                        "symbol_addr": "0x102684000",
                                    },
                                    {
                                        "function": "UIApplicationMain",
                                        "symbol": "UIApplicationMain",
                                        "package": "UIKitCore",
                                        "in_app": False,
                                        "data": {
                                            "category": "threadbase",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x183f6b000",
                                        "instruction_addr": "0x184203954",
                                        "symbol_addr": "0x18420312c",
                                    },
                                    {
                                        "function": "-[UIApplication _run]",
                                        "symbol": "-[UIApplication _run]",
                                        "package": "UIKitCore",
                                        "in_app": False,
                                        "data": {
                                            "category": "ui",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x183f6b000",
                                        "instruction_addr": "0x184485084",
                                        "symbol_addr": "0x184484c3c",
                                    },
                                    {
                                        "function": "GSEventRunModal",
                                        "symbol": "GSEventRunModal",
                                        "package": "GraphicsServices",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x19d66d000",
                                        "instruction_addr": "0x19d66e388",
                                        "symbol_addr": "0x19d66e2e8",
                                    },
                                    {
                                        "function": "CFRunLoopRunSpecific",
                                        "symbol": "CFRunLoopRunSpecific",
                                        "package": "CoreFoundation",
                                        "in_app": False,
                                        "data": {
                                            "category": "indirection",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x181ac4000",
                                        "instruction_addr": "0x181ae3464",
                                        "symbol_addr": "0x181ae3210",
                                    },
                                    {
                                        "function": "__CFRunLoopRun",
                                        "symbol": "__CFRunLoopRun",
                                        "package": "CoreFoundation",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x181ac4000",
                                        "instruction_addr": "0x181acf8a0",
                                        "symbol_addr": "0x181acf570",
                                    },
                                    {
                                        "function": "__CFRunLoopDoSources0",
                                        "symbol": "__CFRunLoopDoSources0",
                                        "package": "CoreFoundation",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x181ac4000",
                                        "instruction_addr": "0x181aca094",
                                        "symbol_addr": "0x181ac9f8c",
                                    },
                                    {
                                        "function": "__CFRunLoopDoSource0",
                                        "symbol": "__CFRunLoopDoSource0",
                                        "package": "CoreFoundation",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x181ac4000",
                                        "instruction_addr": "0x181b8fd8c",
                                        "symbol_addr": "0x181b8fcc0",
                                    },
                                    {
                                        "function": "__CFRUNLOOP_IS_CALLING_OUT_TO_A_SOURCE0_PERFORM_FUNCTION__",
                                        "symbol": "__CFRUNLOOP_IS_CALLING_OUT_TO_A_SOURCE0_PERFORM_FUNCTION__",
                                        "package": "CoreFoundation",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x181ac4000",
                                        "instruction_addr": "0x181b7f0cc",
                                        "symbol_addr": "0x181b7f0b4",
                                    },
                                    {
                                        "function": "-[FBSSerialQueue _performNextFromRunLoopSource]",
                                        "symbol": "-[FBSSerialQueue _performNextFromRunLoopSource]",
                                        "package": "FrontBoardServices",
                                        "in_app": False,
                                        "data": {"symbolicator_status": "symbolicated"},
                                        "image_addr": "0x19378c000",
                                        "instruction_addr": "0x19379b410",
                                        "symbol_addr": "0x19379b3f8",
                                    },
                                    {
                                        "function": "-[FBSSerialQueue _targetQueue_performNextIfPossible]",
                                        "symbol": "-[FBSSerialQueue _targetQueue_performNextIfPossible]",
                                        "package": "FrontBoardServices",
                                        "in_app": False,
                                        "data": {"symbolicator_status": "symbolicated"},
                                        "image_addr": "0x19378c000",
                                        "instruction_addr": "0x193796d88",
                                        "symbol_addr": "0x193796cb0",
                                    },
                                    {
                                        "function": "__FBSSERIALQUEUE_IS_CALLING_OUT_TO_A_BLOCK__",
                                        "symbol": "__FBSSERIALQUEUE_IS_CALLING_OUT_TO_A_BLOCK__",
                                        "package": "FrontBoardServices",
                                        "in_app": False,
                                        "data": {"symbolicator_status": "symbolicated"},
                                        "image_addr": "0x19378c000",
                                        "instruction_addr": "0x1937979c0",
                                        "symbol_addr": "0x193797994",
                                    },
                                    {
                                        "function": "_dispatch_block_invoke_direct",
                                        "symbol": "_dispatch_block_invoke_direct",
                                        "package": "libdispatch.dylib",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x1817cb000",
                                        "instruction_addr": "0x1817d3124",
                                        "symbol_addr": "0x1817d3020",
                                    },
                                    {
                                        "function": "_dispatch_client_callout",
                                        "symbol": "_dispatch_client_callout",
                                        "package": "libdispatch.dylib",
                                        "in_app": False,
                                        "data": {
                                            "category": "threadbase",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x1817cb000",
                                        "instruction_addr": "0x1817cf66c",
                                        "symbol_addr": "0x1817cf65c",
                                    },
                                    {
                                        "function": "__63-[FBSWorkspaceScenesClient willTerminateWithTransitionContext:]_block_invoke",
                                        "symbol": "__63-[FBSWorkspaceScenesClient willTerminateWithTransitionContext:]_block_invoke",
                                        "package": "FrontBoardServices",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x19378c000",
                                        "instruction_addr": "0x1937db714",
                                        "symbol_addr": "0x1937db694",
                                    },
                                    {
                                        "function": "-[FBSWorkspace _calloutQueue_executeCalloutFromSource:withBlock:]",
                                        "symbol": "-[FBSWorkspace _calloutQueue_executeCalloutFromSource:withBlock:]",
                                        "package": "FrontBoardServices",
                                        "in_app": False,
                                        "data": {"symbolicator_status": "symbolicated"},
                                        "image_addr": "0x19378c000",
                                        "instruction_addr": "0x193796068",
                                        "symbol_addr": "0x193795f7c",
                                    },
                                    {
                                        "function": "__63-[FBSWorkspaceScenesClient willTerminateWithTransitionContext:]_block_invoke_2",
                                        "symbol": "__63-[FBSWorkspaceScenesClient willTerminateWithTransitionContext:]_block_invoke_2",
                                        "package": "FrontBoardServices",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x19378c000",
                                        "instruction_addr": "0x1937db77c",
                                        "symbol_addr": "0x1937db730",
                                    },
                                    {
                                        "function": "-[UIApplication workspaceShouldExit:withTransitionContext:]",
                                        "symbol": "-[UIApplication workspaceShouldExit:withTransitionContext:]",
                                        "package": "UIKitCore",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x183f6b000",
                                        "instruction_addr": "0x184ebc298",
                                        "symbol_addr": "0x184ebc1c8",
                                    },
                                    {
                                        "function": "-[_UISceneLifecycleMultiplexer forceExitWithTransitionContext:scene:]",
                                        "symbol": "-[_UISceneLifecycleMultiplexer forceExitWithTransitionContext:scene:]",
                                        "package": "UIKitCore",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x183f6b000",
                                        "instruction_addr": "0x18479ca7c",
                                        "symbol_addr": "0x18479c9a0",
                                    },
                                    {
                                        "function": "-[_UISceneLifecycleMultiplexer _evalTransitionToSettings:fromSettings:forceExit:withTransitionStore:]",
                                        "symbol": "-[_UISceneLifecycleMultiplexer _evalTransitionToSettings:fromSettings:forceExit:withTransitionStore:]",
                                        "package": "UIKitCore",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x183f6b000",
                                        "instruction_addr": "0x1845a7b34",
                                        "symbol_addr": "0x1845a7ab8",
                                    },
                                    {
                                        "function": "-[UIApplication _terminateWithStatus:]",
                                        "symbol": "-[UIApplication _terminateWithStatus:]",
                                        "package": "UIKitCore",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x183f6b000",
                                        "instruction_addr": "0x184ebf71c",
                                        "symbol_addr": "0x184ebf528",
                                    },
                                    {
                                        "function": "exit",
                                        "symbol": "exit",
                                        "package": "libsystem_c.dylib",
                                        "in_app": False,
                                        "data": {
                                            "category": "shutdown",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x18ca01000",
                                        "instruction_addr": "0x18ca1c224",
                                        "symbol_addr": "0x18ca1c208",
                                    },
                                    {
                                        "function": "__cxa_finalize_ranges",
                                        "symbol": "__cxa_finalize_ranges",
                                        "package": "libsystem_c.dylib",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x18ca01000",
                                        "instruction_addr": "0x18ca218c0",
                                        "symbol_addr": "0x18ca216f8",
                                    },
                                    {
                                        "function": "__cxa_finalize_ranges",
                                        "symbol": "__cxa_finalize_ranges",
                                        "package": "libsystem_c.dylib",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x18ca01000",
                                        "instruction_addr": "0x18ca218c0",
                                        "symbol_addr": "0x18ca216f8",
                                    },
                                    {
                                        "function": "<redacted>",
                                        "package": "MetalPerformanceShadersGraph",
                                        "in_app": False,
                                        "data": {"symbolicator_status": "missing_symbol"},
                                        "image_addr": "0x1bec7a000",
                                        "instruction_addr": "0x1bf179c98",
                                        "symbol_addr": "0x0",
                                    },
                                ]
                            },
                            "crashed": False,
                            "current": False,
                        },
                        {
                            "id": 1,
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "_pthread_wqthread",
                                        "symbol": "_pthread_wqthread",
                                        "package": "libsystem_pthread.dylib",
                                        "in_app": False,
                                        "data": {
                                            "category": "threadbase",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x1f2532000",
                                        "instruction_addr": "0x1f253313c",
                                        "symbol_addr": "0x1f2532fd4",
                                    },
                                    {
                                        "function": "__workq_kernreturn",
                                        "symbol": "__workq_kernreturn",
                                        "package": "libsystem_kernel.dylib",
                                        "in_app": False,
                                        "data": {
                                            "category": "internals",
                                            "symbolicator_status": "symbolicated",
                                        },
                                        "image_addr": "0x1b9090000",
                                        "instruction_addr": "0x1b9091b2c",
                                        "symbol_addr": "0x1b9091b24",
                                    },
                                ]
                            },
                            "crashed": False,
                            "current": False,
                        },
                    ]
                },
            },
            project_id=self.project.id,
        )

        frames = find_stack_frames(event.data)
        assert len(frames) == 0  # exception has no frames, no threads that are crashed, or current


class WaterFallTestCase(TestCase):
    def test_only_exception_interface_with_no_stacktrace(self):
        event = self.store_event(
            data={
                "exception": {
                    "values": [
                        {
                            "type": "EXC_BAD_ACCESS",
                            "value": "Attempted to dereference a null pointer",
                        }
                    ]
                }
            },
            project_id=self.project.id,
        )

        frames = find_stack_frames(event.data)
        assert len(frames) == 0

    def test_only_exception_interface_single_stacktrace(self):
        event = self.store_event(
            data={
                "exception": {
                    "values": [
                        {
                            "type": "EXC_BAD_ACCESS",
                            "value": "Attempted to dereference a null pointer",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "invoke0",
                                        "abs_path": "NativeMethodAccessorImpl.java",
                                        "in_app": False,
                                        "module": "jdk.internal.reflect.NativeMethodAccessorImpl",
                                        "filename": "NativeMethodAccessorImpl.java",
                                    }
                                ],
                                "registers": {},
                            },
                        }
                    ]
                }
            },
            project_id=self.project.id,
        )

        frames = find_stack_frames(event.data)
        assert len(frames) == 1
        assert frames[0]["function"] == "invoke0"
        assert frames[0]["filename"] == "NativeMethodAccessorImpl.java"

    def test_only_stacktrace_interface(self):
        event = self.store_event(
            data={
                "stacktrace": {
                    "frames": [
                        {
                            "function": "invoke0",
                            "abs_path": "NativeMethodAccessorImpl.java",
                            "in_app": False,
                            "module": "jdk.internal.reflect.NativeMethodAccessorImpl",
                            "filename": "NativeMethodAccessorImpl.java",
                        }
                    ],
                    "registers": {},
                },
            },
            project_id=self.project.id,
        )

        frames = find_stack_frames(event.data)
        assert len(frames) == 1
        assert frames[0]["function"] == "invoke0"
        assert frames[0]["filename"] == "NativeMethodAccessorImpl.java"

    def test_only_thread_interface(self):
        event = self.store_event(
            data={
                "threads": {
                    "values": [
                        {
                            "id": 0,
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "invoke0",
                                        "abs_path": "NativeMethodAccessorImpl.java",
                                        "in_app": False,
                                        "module": "jdk.internal.reflect.NativeMethodAccessorImpl",
                                        "filename": "NativeMethodAccessorImpl.java",
                                    }
                                ],
                                "registers": {},
                            },
                            "crashed": False,
                            "current": False,
                        }
                    ]
                }
            },
            project_id=self.project.id,
        )

        frames = find_stack_frames(event.data)
        assert len(frames) == 1
        assert frames[0]["function"] == "invoke0"
        assert frames[0]["filename"] == "NativeMethodAccessorImpl.java"

    def test_only_thread_interface_flattened(self):
        event = self.store_event(
            data={
                "threads": [
                    {
                        "id": 0,
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "invoke0",
                                    "abs_path": "NativeMethodAccessorImpl.java",
                                    "in_app": False,
                                    "module": "jdk.internal.reflect.NativeMethodAccessorImpl",
                                    "filename": "NativeMethodAccessorImpl.java",
                                }
                            ],
                            "registers": {},
                        },
                        "crashed": False,
                        "current": False,
                    }
                ]
            },
            project_id=self.project.id,
        )

        frames = find_stack_frames(event.data)
        assert len(frames) == 1
        assert frames[0]["function"] == "invoke0"
        assert frames[0]["filename"] == "NativeMethodAccessorImpl.java"

    def test_exception_and_stacktrace_interfaces(self):
        exception_frame = {
            "function": "invoke0",
            "abs_path": "NativeMethodAccessorImpl.java",
            "in_app": False,
            "module": "jdk.internal.reflect.NativeMethodAccessorImpl",
            "filename": "NativeMethodAccessorImpl.java",
        }

        # event.stacktrace will get re-processed and moved over to event.exception.values[0].stacktrace
        event = self.store_event(
            data={
                "exception": {
                    "values": [
                        {
                            "type": "EXC_BAD_ACCESS",
                            "value": "Attempted to dereference a null pointer",
                            "stacktrace": {
                                "frames": [{"doesn't": "matter"}],
                                "registers": {},
                            },
                        }
                    ]
                },
                "stacktrace": {
                    "frames": [exception_frame],
                    "registers": {},
                },
            },
            project_id=self.project.id,
        )

        frames = find_stack_frames(event.data)
        assert len(frames) == 1
        assert exception_frame.items() <= frames[0].items()

    def test_exception_and_stacktrace_and_thread_interfaces(self):
        # no stacktrace frame in exception interface, so we waterfall to the threads interface
        event = self.store_event(
            data={
                "exception": {
                    "values": [
                        {
                            "type": "EXC_BAD_ACCESS",
                            "value": "Attempted to dereference a null pointer",
                        }
                    ]
                },
                "threads": {
                    "values": [
                        {
                            "id": 0,
                            "stacktrace": {
                                "frames": [
                                    {
                                        "module": "io.sentry.example.Application",
                                        "filename": "Application.java",
                                    },
                                ],
                                "registers": {},
                            },
                            "crashed": False,
                            "current": False,
                        }
                    ]
                },
            },
            project_id=self.project.id,
        )

        frames = find_stack_frames(event.data)
        assert len(frames) == 1
        assert frames[0]["module"] == "io.sentry.example.Application"
        assert frames[0]["filename"] == "Application.java"
