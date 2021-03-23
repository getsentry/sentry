import pytest

from sentry.grouping.api import get_default_grouping_config_dict, load_grouping_config
from sentry.stacktraces.processing import (
    find_stacktraces_in_data,
    normalize_stacktraces_for_grouping,
    get_crash_frame_from_event_data,
)
from sentry.testutils import TestCase


class FindStacktracesTest(TestCase):
    def test_stacktraces_basics(self):
        data = {
            "message": "hello",
            "platform": "javascript",
            "stacktrace": {
                "frames": [
                    {
                        "abs_path": "http://example.com/foo.js",
                        "filename": "foo.js",
                        "lineno": 4,
                        "colno": 0,
                    },
                    {
                        "abs_path": "http://example.com/foo.js",
                        "filename": "foo.js",
                        "lineno": 1,
                        "colno": 0,
                        "platform": "native",
                    },
                ]
            },
        }

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        assert len(infos[0].stacktrace["frames"]) == 2
        assert infos[0].platforms == {"javascript", "native"}

    def test_stacktraces_exception(self):
        data = {
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 4,
                                    "colno": 0,
                                },
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 1,
                                    "colno": 0,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        assert len(infos[0].stacktrace["frames"]) == 2

    def test_stacktraces_threads(self):
        data = {
            "message": "hello",
            "platform": "javascript",
            "threads": {
                "values": [
                    {
                        "id": "4711",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 4,
                                    "colno": 0,
                                },
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 1,
                                    "colno": 0,
                                },
                            ]
                        },
                    }
                ]
            },
        }

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        assert len(infos[0].stacktrace["frames"]) == 2

    def test_find_stacktraces_skip_none(self):
        # This tests:
        #  1. exception is None
        #  2. stacktrace is None
        #  3. frames is None
        #  3. frames contains only None
        #  4. frame is None
        data = {
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    None,
                    {"type": "Error", "stacktrace": None},
                    {"type": "Error", "stacktrace": {"frames": None}},
                    {"type": "Error", "stacktrace": {"frames": [None]}},
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                None,
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 4,
                                    "colno": 0,
                                },
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 1,
                                    "colno": 0,
                                },
                            ]
                        },
                    },
                ]
            },
        }

        infos = find_stacktraces_in_data(data, with_exceptions=True)
        assert len(infos) == 4
        assert sum(1 for x in infos if x.stacktrace) == 3
        assert sum(1 for x in infos if x.is_exception) == 4
        # XXX: The null frame is still part of this stack trace!
        assert len(infos[3].stacktrace["frames"]) == 3

        infos = find_stacktraces_in_data(data)
        assert len(infos) == 1
        # XXX: The null frame is still part of this stack trace!
        assert len(infos[0].stacktrace["frames"]) == 3


class NormalizeInApptest(TestCase):
    def test_normalize_with_system_frames(self):
        data = {
            "stacktrace": {
                "frames": [
                    None,
                    {
                        "abs_path": "http://example.com/foo.js",
                        "filename": "foo.js",
                        "lineno": 4,
                        "colno": 0,
                        "in_app": True,
                    },
                    {
                        "abs_path": "http://example.com/foo.js",
                        "filename": "foo.js",
                        "lineno": 1,
                        "colno": 0,
                    },
                ]
            }
        }

        normalize_stacktraces_for_grouping(data)
        assert data["stacktrace"]["frames"][1]["in_app"] is True
        assert data["stacktrace"]["frames"][2]["in_app"] is False

    def test_normalize_skips_none(self):
        data = {
            "stacktrace": {
                "frames": [
                    None,
                    {
                        "abs_path": "http://example.com/foo.js",
                        "filename": "foo.js",
                        "lineno": 4,
                        "colno": 0,
                    },
                    {
                        "abs_path": "http://example.com/foo.js",
                        "filename": "foo.js",
                        "lineno": 1,
                        "colno": 0,
                    },
                ]
            }
        }

        normalize_stacktraces_for_grouping(data)
        assert data["stacktrace"]["frames"][1]["in_app"] is False
        assert data["stacktrace"]["frames"][2]["in_app"] is False

    def test_ios_package_in_app_detection(self):
        data = {
            "platform": "native",
            "stacktrace": {
                "frames": [
                    {
                        "package": "/var/containers/Bundle/Application/B33C37A8-F933-4B6B-9FFA-152282BFDF13/SentryTest.app/SentryTest",
                        "instruction_addr": "0x1000",
                    },
                    {
                        "package": "/var/containers/Bundle/Application/B33C37A8-F933-4B6B-9FFA-152282BFDF13/SentryTest.app/Frameworks/foo.dylib",
                        "instruction_addr": "0x2000",
                    },
                    {
                        "package": "/var/containers/Bundle/Application/B33C37A8-F933-4B6B-9FFA-152282BFDF13/SentryTest.app/Frameworks/libswiftCore.dylib",
                        "instruction_addr": "0x3000",
                    },
                    {"package": "/usr/lib/whatever.dylib", "instruction_addr": "0x4000"},
                ]
            },
        }

        config = load_grouping_config(get_default_grouping_config_dict())
        normalize_stacktraces_for_grouping(data, grouping_config=config)

        # App object should be in_app
        assert data["stacktrace"]["frames"][0]["in_app"] is True
        # Framework should be in app (but optional)
        assert data["stacktrace"]["frames"][1]["in_app"] is True
        # libswift should not be system
        assert data["stacktrace"]["frames"][2]["in_app"] is False
        # Unknown object should default to not in_app
        assert data["stacktrace"]["frames"][3]["in_app"] is False

    def tes_macos_package_in_app_detection(self):
        data = {
            "platform": "cocoa",
            "debug_meta": {"images": []},  # omitted
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "-[CRLCrashAsyncSafeThread crash]",
                                    "package": "/Users/haza/Library/Developer/Xcode/Archives/2017-06-19/CrashProbe 19-06-2017, 08.53.xcarchive/Products/Applications/CrashProbe.app/Contents/Frameworks/CrashLib.framework/Versions/A/CrashLib",
                                    "instruction_addr": 4295098388,
                                },
                                {
                                    "function": "[KSCrash ]",
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "instruction_addr": 4295098388,
                                },
                            ]
                        },
                        "type": "NSRangeException",
                    }
                ]
            },
            "contexts": {"os": {"version": "10.12.5", "type": "os", "name": "macOS"}},
        }

        config = load_grouping_config(get_default_grouping_config_dict())
        normalize_stacktraces_for_grouping(data, grouping_config=config)

        frames = data["exception"]["values"][0]["stacktrace"]["frames"]
        assert frames[0]["in_app"] is True
        assert frames[1]["in_app"] is False

    def ios_function_name_in_app_detection(self, function, isInApp: bool):
        data = {
            "platform": "cocoa",
            "debug_meta": {"images": []},  # omitted
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": function,
                                    "package": "/var/containers/Bundle/Application/B33C37A8-F933-4B6B-9FFA-152282BFDF13/SentryTest.app/SentryTest",
                                    "instruction_addr": 4295098388,
                                },
                                # We need two frames otherwise all frames are inApp
                                {
                                    "function": "[KSCrash ]",
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "instruction_addr": 4295098388,
                                },
                            ]
                        },
                        "type": "NSRangeException",
                    }
                ]
            },
            "contexts": {"os": {"version": "9.3.2", "type": "os", "name": "iOS"}},
        }

        config = load_grouping_config(get_default_grouping_config_dict())
        normalize_stacktraces_for_grouping(data, grouping_config=config)

        frames = data["exception"]["values"][0]["stacktrace"]["frames"]
        assert frames[0]["in_app"] is isInApp, (
            "For function: " + function + " expected:" + str(isInApp)
        )

    def test_ios_function_name_in_app_detection(self):
        self.ios_function_name_in_app_detection(
            function="sentrycrash__hook_dispatch_async", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="sentrycrash__hook_dispatch_after_f", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="sentrycrash__async_backtrace_capture", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="__sentrycrash__hook_dispatch_async_block_invoke", isInApp=False
        )

        self.ios_function_name_in_app_detection(function="kscm_f", isInApp=False)
        self.ios_function_name_in_app_detection(function="kscm_", isInApp=False)
        self.ios_function_name_in_app_detection(function=" kscm_", isInApp=False)
        self.ios_function_name_in_app_detection(function="kscm", isInApp=True)

        self.ios_function_name_in_app_detection(function="sentrycrashcm_f", isInApp=False)
        self.ios_function_name_in_app_detection(function="sentrycrashcm_", isInApp=False)
        self.ios_function_name_in_app_detection(function=" sentrycrashcm_", isInApp=False)
        self.ios_function_name_in_app_detection(function="sentrycrashcm", isInApp=True)

        self.ios_function_name_in_app_detection(function="kscrash_f", isInApp=False)
        self.ios_function_name_in_app_detection(function="kscrash_", isInApp=False)
        self.ios_function_name_in_app_detection(function=" kscrash_", isInApp=False)
        self.ios_function_name_in_app_detection(function="kscrash", isInApp=True)

        self.ios_function_name_in_app_detection(function="sentrycrash_f", isInApp=False)
        self.ios_function_name_in_app_detection(function="sentrycrash_", isInApp=False)
        self.ios_function_name_in_app_detection(function=" sentrycrash_", isInApp=False)
        self.ios_function_name_in_app_detection(function="sentrycrash", isInApp=True)

        self.ios_function_name_in_app_detection(function="+[KSCrash ]", isInApp=False)
        self.ios_function_name_in_app_detection(function="-[KSCrash]", isInApp=False)
        self.ios_function_name_in_app_detection(function="-[KSCrashy]", isInApp=False)
        self.ios_function_name_in_app_detection(function="-[MyKSCrashy ", isInApp=True)

        self.ios_function_name_in_app_detection(function="+[RNSentry ]", isInApp=False)
        self.ios_function_name_in_app_detection(function="-[RNSentry]", isInApp=False)
        self.ios_function_name_in_app_detection(function="-[RNSentry]", isInApp=False)
        self.ios_function_name_in_app_detection(function="-[MRNSentry ]", isInApp=True)

        self.ios_function_name_in_app_detection(function="+[Sentry ]", isInApp=False)
        self.ios_function_name_in_app_detection(function="-[Sentry]", isInApp=False)
        self.ios_function_name_in_app_detection(function="-[Sentry]", isInApp=False)
        self.ios_function_name_in_app_detection(function="-[MSentry capture]", isInApp=True)

        self.ios_function_name_in_app_detection(
            function="-[SentryHub captureMessage]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryClient captureMessage]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="+[SentrySDK captureMessage]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryStacktraceBuilder buildStacktraceForCurrentThread]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryThreadInspector getCurrentThreads]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryClient captureMessage:withScope:]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryFrameInAppLogic isInApp:]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryFrameRemover removeNonSdkFrames:]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryDebugMetaBuilder buildDebugMeta:withScope:]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryCrashAdapter crashedLastLaunch]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryCrashAdapter isRateLimitActive:]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryTransport sendEvent:attachments:]", isInApp=False
        )
        self.ios_function_name_in_app_detection(
            function="-[SentryHttpTransport sendEvent:attachments:]", isInApp=False
        )


@pytest.mark.parametrize(
    "event",
    [
        {"threads": {"values": [{"stacktrace": {"frames": [{"in_app": True, "marco": "polo"}]}}]}},
        {
            "exception": {
                "values": [{"stacktrace": {"frames": [{"in_app": True, "marco": "polo"}]}}]
            }
        },
        {"stacktrace": {"frames": [{"in_app": True, "marco": "polo"}]}},
    ],
)
def test_get_crash_frame(event):
    assert get_crash_frame_from_event_data(event)["marco"] == "polo"
