from copy import deepcopy
from typing import Any, Dict

from sentry.lang.javascript.plugin import generate_modules
from sentry.lang.javascript.utils import generate_module, trim_line

LONG_LINE = "The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring."


def test_trim_line():
    assert trim_line("foo") == "foo"
    assert (
        trim_line(LONG_LINE)
        == "The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it li {snip}"
    )
    assert (
        trim_line(LONG_LINE, column=10)
        == "The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it li {snip}"
    )
    assert (
        trim_line(LONG_LINE, column=66)
        == "{snip} blic is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it lives wi {snip}"
    )
    assert (
        trim_line(LONG_LINE, column=190)
        == "{snip} gn. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring."
    )
    assert (
        trim_line(LONG_LINE, column=9999)
        == "{snip} gn. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring."
    )


def test_generate_module():
    assert generate_module(None) == "<unknown module>"
    assert generate_module("http://example.com/foo.js") == "foo"
    assert generate_module("http://example.com/foo/bar.js") == "foo/bar"
    assert generate_module("http://example.com/js/foo/bar.js") == "foo/bar"
    assert generate_module("http://example.com/javascript/foo/bar.js") == "foo/bar"
    assert generate_module("http://example.com/1.0/foo/bar.js") == "foo/bar"
    assert generate_module("http://example.com/v1/foo/bar.js") == "foo/bar"
    assert generate_module("http://example.com/v1.0.0/foo/bar.js") == "foo/bar"
    assert generate_module("http://example.com/_baz/foo/bar.js") == "foo/bar"
    assert generate_module("http://example.com/1/2/3/foo/bar.js") == "foo/bar"
    assert generate_module("http://example.com/abcdef0/foo/bar.js") == "foo/bar"
    assert (
        generate_module("http://example.com/92cd589eca8235e7b373bf5ae94ebf898e3b949c/foo/bar.js")
        == "foo/bar"
    )
    assert (
        generate_module("http://example.com/7d6d00eae0ceccdc7ee689659585d95f/foo/bar.js")
        == "foo/bar"
    )
    assert generate_module("http://example.com/foo/bar.coffee") == "foo/bar"
    assert generate_module("http://example.com/foo/bar.js?v=1234") == "foo/bar"
    assert generate_module("/foo/bar.js") == "foo/bar"
    assert generate_module("/foo/bar.ts") == "foo/bar"
    assert generate_module("../../foo/bar.js") == "foo/bar"
    assert generate_module("../../foo/bar.ts") == "foo/bar"
    assert generate_module("../../foo/bar.awesome") == "foo/bar"
    assert generate_module("../../foo/bar") == "foo/bar"
    assert generate_module("/foo/bar-7d6d00eae0ceccdc7ee689659585d95f.js") == "foo/bar"
    assert generate_module("/bower_components/foo/bar.js") == "foo/bar"
    assert generate_module("/node_modules/foo/bar.js") == "foo/bar"
    assert (
        generate_module("http://example.com/vendor.92cd589eca8235e7b373bf5ae94ebf898e3b949c.js")
        == "vendor"
    )
    assert (
        generate_module("/a/javascripts/application-bundle-149360d3414c26adac3febdf6832e25c.min.js")
        == "a/javascripts/application-bundle"
    )
    assert generate_module("https://example.com/libs/libs-20150417171659.min.js") == "libs/libs"
    assert (
        generate_module("webpack:///92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js") == "vendor"
    )
    assert (
        generate_module("webpack:///92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js") == "vendor"
    )
    assert generate_module("app:///92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js") == "vendor"
    assert (
        generate_module("app:///example/92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js")
        == "vendor"
    )
    assert (
        generate_module("~/app/components/projectHeader/projectSelector.jsx")
        == "app/components/projectHeader/projectSelector"
    )


def test_ensure_module_names():
    data: Dict[str, Any] = {
        "message": "hello",
        "platform": "javascript",
        "exception": {
            "values": [
                {
                    "type": "Error",
                    "stacktrace": {
                        "frames": [
                            {
                                "filename": "foo.js",
                                "lineno": 4,
                                "colno": 0,
                                "function": "thing",
                            },
                            {
                                "abs_path": "http://example.com/foo/bar.js",
                                "filename": "bar.js",
                                "lineno": 1,
                                "colno": 0,
                                "function": "oops",
                            },
                        ]
                    },
                }
            ]
        },
    }

    generate_modules(data)
    exc = data["exception"]["values"][0]
    assert exc["stacktrace"]["frames"][1]["module"] == "foo/bar"


def test_generate_modules_skips_none():
    expected = {
        "culprit": "",
        "exception": {
            "values": [
                None,
                {},
                {"value": "MyError", "stacktrace": None},
                {"value": "MyError", "stacktrace": {"frames": None}},
                {"value": "MyError", "stacktrace": {"frames": [None]}},
            ]
        },
    }

    actual = deepcopy(expected)
    generate_modules(actual)
    assert actual == expected
