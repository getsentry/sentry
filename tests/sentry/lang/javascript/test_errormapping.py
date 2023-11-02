import unittest
from copy import deepcopy
from typing import Any, Dict

import responses
from sentry_relay.processing import StoreNormalizer

from sentry.constants import DEFAULT_STORE_NORMALIZER_ARGS
from sentry.lang.javascript.errormapping import REACT_MAPPING_URL, rewrite_exception


class ErrorMappingTest(unittest.TestCase):
    @responses.activate
    def test_react_error_mapping_resolving(self):
        responses.add(
            responses.GET,
            REACT_MAPPING_URL,
            body=r"""
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes.",
          "109": "%s.render(): A valid React element (or null) must be returned. You may have returned undefined, an array or some other invalid object.",
          "110": "Stateless function components cannot have refs."
        }
        """,
            content_type="application/json",
        )

        for x in range(3):
            data: Dict[str, Any] = {
                "platform": "javascript",
                "exception": {
                    "values": [
                        {
                            "type": "InvariantViolation",
                            "value": (
                                "Minified React error #109; visit http://facebook"
                                ".github.io/react/docs/error-decoder.html?invariant="
                                "109&args[]=Component for the full message or use "
                                "the non-minified dev environment for full errors "
                                "and additional helpful warnings."
                            ),
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

            assert rewrite_exception(data)

            assert data["exception"]["values"][0]["value"] == (
                "Component.render(): A valid React element (or null) must be "
                "returned. You may have returned undefined, an array or "
                "some other invalid object."
            )

    @responses.activate
    def test_react_error_mapping_empty_args(self):
        responses.add(
            responses.GET,
            REACT_MAPPING_URL,
            body=r"""
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes."
        }
        """,
            content_type="application/json",
        )

        data: Dict[str, Any] = {
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "InvariantViolation",
                        "value": (
                            "Minified React error #108; visit http://facebook"
                            ".github.io/react/docs/error-decoder.html?invariant="
                            "108&args[]=Component&args[]= for the full message "
                            "or use the non-minified dev environment for full "
                            "errors and additional helpful warnings."
                        ),
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 4,
                                    "colno": 0,
                                }
                            ]
                        },
                    }
                ]
            },
        }

        assert rewrite_exception(data)

        assert data["exception"]["values"][0]["value"] == (
            'Component.getChildContext(): key "" is not defined in ' "childContextTypes."
        )

    @responses.activate
    def test_react_error_mapping_truncated(self):
        responses.add(
            responses.GET,
            REACT_MAPPING_URL,
            body=r"""
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes."
        }
        """,
            content_type="application/json",
        )

        data: Dict[str, Any] = {
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "InvariantViolation",
                        "value": (
                            "Minified React error #108; visit http://facebook"
                            ".github.io/react/docs/error-decoder.html?\u2026"
                        ),
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 4,
                                    "colno": 0,
                                }
                            ]
                        },
                    }
                ]
            },
        }

        assert rewrite_exception(data)

        assert data["exception"]["values"][0]["value"] == (
            '<redacted>.getChildContext(): key "<redacted>" is not defined in ' "childContextTypes."
        )

    @responses.activate
    def test_react_error_adds_meta(self):
        responses.add(
            responses.GET,
            REACT_MAPPING_URL,
            body=r"""
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes.",
          "109": "%s.render(): A valid React element (or null) must be returned. You may have returned undefined, an array or some other invalid object.",
          "110": "Stateless function components cannot have refs."
        }
        """,
            content_type="application/json",
        )

        value_109 = (
            "Minified React error #109; visit http://facebook"
            ".github.io/react/docs/error-decoder.html?invariant="
            "109&args[]=Component for the full message or use "
            "the non-minified dev environment for full errors "
            "and additional helpful warnings."
        )

        value_108 = (
            "Minified React error #108; visit http://facebook"
            ".github.io/react/docs/error-decoder.html?\u2026"
        )

        data = {
            "platform": "javascript",
            "transaction": "fancy",
            "exception": {
                "values": [
                    # Set first item to be None to check that we handle this case.
                    None,
                    {
                        "type": "InvariantViolation",
                        "value": value_109,
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
                    },
                    # Non react minified error
                    {
                        "type": "Error",
                        "value": "this is not a react minified error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 1,
                                    "colno": 0,
                                },
                            ],
                        },
                    },
                    {
                        "type": "InvariantViolation",
                        "value": value_108,
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/foo.js",
                                    "filename": "foo.js",
                                    "lineno": 4,
                                    "colno": 0,
                                }
                            ]
                        },
                    },
                ]
            },
            "_meta": {
                "transaction": {
                    "": {
                        "err": ["existing", "additional"],
                    }
                }
            },
        }

        assert rewrite_exception(data)

        # run data through normalization to ensure that the meta is set properly
        normalizer = StoreNormalizer(
            remove_other=False, is_renormalize=True, **DEFAULT_STORE_NORMALIZER_ARGS
        )
        data = normalizer.normalize_event(dict(data))

        assert data["_meta"] == {
            "exception": {
                "values": {
                    "1": {"value": {"": {"rem": [["@processing:react", "s"]], "val": value_109}}},
                    "3": {"value": {"": {"rem": [["@processing:react", "s"]], "val": value_108}}},
                }
            },
            "transaction": {
                "": {
                    "err": ["existing", "additional"],
                }
            },
        }

    @responses.activate
    def test_skip_none_values(self):
        expected: Dict[str, Any] = {"exception": {"values": [None, {}]}}

        actual = deepcopy(expected)
        assert not rewrite_exception(actual)

        assert actual == expected
