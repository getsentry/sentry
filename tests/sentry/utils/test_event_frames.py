import unittest

from sentry.testutils import TestCase
from sentry.utils.event_frames import (
    find_stack_frames,
    get_crashing_thread,
    munged_filename_and_frames,
)


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
        key, munged_frames = munged_filename_and_frames("java", frames, "munged_filename")
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
        key, munged_frames = munged_filename_and_frames("java", exception_frames, "munged_filename")
        assert len(munged_frames) == 16
        for z in zip(exception_frames, munged_frames):
            assert z[0].items() <= z[1].items()

        has_munged = list(filter(lambda f: f.get("filename") and f.get("module"), munged_frames))
        assert len(has_munged) == 14
        assert all(str(x.get("munged_filename")).endswith(x.get("filename")) for x in has_munged)


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
