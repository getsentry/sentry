import unittest

from sentry.testutils import TestCase
from sentry.utils.event_frames import find_stack_frames, get_crashing_thread, supplement_filename


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
        supplement_filename("other", fake_frame)
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
        supplement_filename("java", frames)
        assert frames[0]["filename"] == "jdk/internal/reflect/NativeMethodAccessorImpl.java"
        assert frames[1]["filename"] == "io/sentry/example/Application.java"
        assert frames[2]["filename"] == "io/sentry/example/Application.java"

    def test_platform_java_no_filename(self):
        no_filename = {
            "module": "io.sentry.example.Application",
        }
        supplement_filename("java", [no_filename])
        assert no_filename["module"] == "io.sentry.example.Application"
        assert "filename" not in no_filename

    def test_platform_java_no_module(self):
        no_filename = {
            "filename": "Application.java",
        }
        supplement_filename("java", [no_filename])
        assert no_filename["filename"] == "Application.java"
        assert "module" not in no_filename


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
