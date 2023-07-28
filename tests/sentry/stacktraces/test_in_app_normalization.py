from sentry.grouping.api import get_default_grouping_config_dict, load_grouping_config
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping
from sentry.testutils import TestCase


def make_stacktrace(frame_0_in_app="not set", frame_1_in_app="not set"):
    frames = [
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
    if frame_0_in_app != "not set":
        frames[0]["in_app"] = frame_0_in_app
    if frame_1_in_app != "not set":
        frames[1]["in_app"] = frame_1_in_app

    return {"frames": frames}


def make_event(stacktraces):
    return {"exception": {"values": [{"stacktrace": stacktrace} for stacktrace in stacktraces]}}


class NormalizeInApptest(TestCase):
    def test_changes_in_app_not_set_into_in_app_False(self):
        event_data = make_event([make_stacktrace(frame_0_in_app=True)])

        normalize_stacktraces_for_grouping(event_data)

        frames = event_data["exception"]["values"][0]["stacktrace"]["frames"]
        assert frames[0]["in_app"] is True
        assert frames[1]["in_app"] is False

    def test_skips_None_frames(self):
        # No arguments means neither example frame will have an `in_app` value
        stacktrace = make_stacktrace()
        stacktrace["frames"].insert(0, None)
        event_data = make_event([stacktrace])

        normalize_stacktraces_for_grouping(event_data)

        frames = event_data["exception"]["values"][0]["stacktrace"]["frames"]
        # The values here weren't set before we called `normalize_stacktraces_for_grouping`,
        # so the fact that they now are shows that it didn't bail when it hit the `None` frame
        assert frames[1]["in_app"] is False
        assert frames[2]["in_app"] is False


class MacOSInAppDetectionTest(TestCase):
    def test_macos_package_in_app_detection(self):
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


class iOSInAppDetectionTest(TestCase):
    def assert_correct_in_app_value(self, function, is_in_app: bool):
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
        assert frames[0]["in_app"] is is_in_app, (
            "For function: " + function + " expected:" + str(is_in_app)
        )

    def test_ios_function_name_in_app_detection(self):
        self.assert_correct_in_app_value(
            function="sentrycrash__hook_dispatch_async", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="sentrycrash__hook_dispatch_after_f", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="sentrycrash__async_backtrace_capture", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="__sentrycrash__hook_dispatch_async_block_invoke", is_in_app=False
        )

        self.assert_correct_in_app_value(function="kscm_f", is_in_app=False)
        self.assert_correct_in_app_value(function="kscm_", is_in_app=False)
        self.assert_correct_in_app_value(function=" kscm_", is_in_app=False)
        self.assert_correct_in_app_value(function="kscm", is_in_app=True)

        self.assert_correct_in_app_value(function="sentrycrashcm_f", is_in_app=False)
        self.assert_correct_in_app_value(function="sentrycrashcm_", is_in_app=False)
        self.assert_correct_in_app_value(function=" sentrycrashcm_", is_in_app=False)
        self.assert_correct_in_app_value(function="sentrycrashcm", is_in_app=True)

        self.assert_correct_in_app_value(function="kscrash_f", is_in_app=False)
        self.assert_correct_in_app_value(function="kscrash_", is_in_app=False)
        self.assert_correct_in_app_value(function=" kscrash_", is_in_app=False)
        self.assert_correct_in_app_value(function="kscrash", is_in_app=True)

        self.assert_correct_in_app_value(function="sentrycrash_f", is_in_app=False)
        self.assert_correct_in_app_value(function="sentrycrash_", is_in_app=False)
        self.assert_correct_in_app_value(function=" sentrycrash_", is_in_app=False)
        self.assert_correct_in_app_value(function="sentrycrash", is_in_app=True)

        self.assert_correct_in_app_value(function="+[KSCrash ]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[KSCrash]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[KSCrashy]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[MyKSCrashy ", is_in_app=True)

        self.assert_correct_in_app_value(function="+[RNSentry ]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[RNSentry]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[RNSentry]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[MRNSentry ]", is_in_app=True)

        self.assert_correct_in_app_value(function="+[Sentry ]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[Sentry]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[Sentry]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[MSentry capture]", is_in_app=True)

        self.assert_correct_in_app_value(function="-[SentryHub captureMessage]", is_in_app=False)
        self.assert_correct_in_app_value(function="-[SentryClient captureMessage]", is_in_app=False)
        self.assert_correct_in_app_value(function="+[SentrySDK captureMessage]", is_in_app=False)
        self.assert_correct_in_app_value(
            function="-[SentryStacktraceBuilder buildStacktraceForCurrentThread]", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="-[SentryThreadInspector getCurrentThreads]", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="-[SentryClient captureMessage:withScope:]", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="-[SentryFrameInAppLogic isInApp:]", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="-[SentryFrameRemover removeNonSdkFrames:]", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="-[SentryDebugMetaBuilder buildDebugMeta:withScope:]", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="-[SentryCrashAdapter crashedLastLaunch]", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="-[SentryCrashAdapter isRateLimitActive:]", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="-[SentryTransport sendEvent:attachments:]", is_in_app=False
        )
        self.assert_correct_in_app_value(
            function="-[SentryHttpTransport sendEvent:attachments:]", is_in_app=False
        )

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
