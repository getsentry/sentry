from __future__ import absolute_import

from sentry.event_manager import EventManager, get_culprit as get_culprit_impl


def get_culprit(data):
    mgr = EventManager(data)
    mgr.normalize()
    return get_culprit_impl(mgr.get_data())


def test_cocoa_culprit():
    culprit = get_culprit(
        {
            "platform": "cocoa",
            "exception": {
                "type": "Crash",
                "stacktrace": {
                    "frames": [
                        {
                            "filename": "foo/baz.c",
                            "package": "/foo/bar/baz.dylib",
                            "lineno": 1,
                            "in_app": True,
                            "function": "-[CRLCrashAsyncSafeThread crash]",
                        }
                    ]
                },
            },
        }
    )
    assert culprit == "-[CRLCrashAsyncSafeThread crash]"


def test_emoji_culprit():
    culprit = get_culprit(
        {
            "platform": "native",
            "exception": {
                "type": "Crash",
                "stacktrace": {
                    "frames": [
                        {
                            "filename": "foo/baz.c",
                            "package": "/foo/bar/baz.dylib",
                            "module": u"\U0001f62d",
                            "lineno": 1,
                            "in_app": True,
                            "function": u"\U0001f60d",
                        }
                    ]
                },
            },
        }
    )
    assert culprit == u"\U0001f60d"


def test_cocoa_strict_stacktrace():
    culprit = get_culprit(
        {
            "platform": "native",
            "exception": {
                "type": "Crash",
                "stacktrace": {
                    "frames": [
                        {
                            "filename": "foo/baz.c",
                            "package": "/foo/bar/libswiftCore.dylib",
                            "lineno": 1,
                            "in_app": False,
                            "function": "fooBar",
                        },
                        {"package": "/foo/bar/MyApp", "in_app": True, "function": "fooBar2"},
                        {
                            "filename": "Mycontroller.swift",
                            "package": "/foo/bar/MyApp",
                            "in_app": True,
                            "function": "-[CRLCrashAsyncSafeThread crash]",
                        },
                    ]
                },
            },
        }
    )
    assert culprit == "-[CRLCrashAsyncSafeThread crash]"


def test_culprit_for_synthetic_event():
    # Synthetic events do not generate a culprit
    culprit = get_culprit(
        {
            "platform": "javascript",
            "exception": {
                "type": "Error",
                "value": "I threw up stringly",
                "mechanism": {"type": "string-error", "synthetic": True},
                "stacktrace": {
                    "frames": [
                        {
                            "filename": "foo/baz.js",
                            "package": "node_modules/blah/foo/bar.js",
                            "lineno": 42,
                            "in_app": True,
                            "function": "fooBar",
                        }
                    ]
                },
            },
        }
    )
    assert culprit == ""


def test_culprit_for_javascript_event():
    culprit = get_culprit(
        {
            "platform": "javascript",
            "exception": {
                "type": "Error",
                "value": "I fail hard",
                "stacktrace": {
                    "frames": [
                        {
                            "filename": "foo/baz.js",
                            "package": "node_modules/blah/foo/bar.js",
                            "lineno": 42,
                            "in_app": True,
                            "function": "fooBar",
                        }
                    ]
                },
            },
        }
    )
    assert culprit == "fooBar(foo/baz.js)"


def test_culprit_for_python_event():
    culprit = get_culprit(
        {
            "platform": "python",
            "exception": {
                "type": "ZeroDivisionError",
                "value": "integer division or modulo by zero",
                "stacktrace": {
                    "frames": [
                        {
                            "filename": "foo/baz.py",
                            "module": "foo.baz",
                            "package": "foo/baz.py",
                            "lineno": 23,
                            "in_app": True,
                            "function": "it_failed",
                        }
                    ]
                },
            },
        }
    )
    assert culprit == "foo.baz in it_failed"
