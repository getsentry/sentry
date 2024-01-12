from __future__ import annotations

from typing import Any

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.event import has_stacktrace, is_handled


@region_silo_test
class HasStacktraceTest(TestCase):
    def test_top_level_stacktrace_detected(self):
        event_data = {
            "stacktrace": {
                "frames": [
                    {
                        "function": "fetchBall",
                        "abs_path": "webpack:///./app/dogpark/fetch.ts",
                        "lineno": 1231,
                        "colno": 1121,
                    }
                ]
            },
        }
        assert has_stacktrace(event_data) is True

    def test_exception_or_threads_stacktrace_detected(self):
        for container in ["exception", "threads"]:
            event_data = {
                container: {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "fetchBall",
                                        "abs_path": "webpack:///./app/dogpark/fetch.ts",
                                        "lineno": 1231,
                                        "colno": 1121,
                                    }
                                ]
                            },
                        },
                    ],
                },
            }
            assert has_stacktrace(event_data) is True, f"Couldn't find stacktrace in `{container}`"

    def test_top_level_empty_stacktrace_ignored(self):
        event_data: dict[str, Any] = {
            "stacktrace": {},
        }
        assert has_stacktrace(event_data) is False

    def test_top_level_empty_frames_ignored(self):
        event_data: dict[str, Any] = {
            "stacktrace": {
                "frames": [],
            },
        }
        assert has_stacktrace(event_data) is False

    def test_exception_or_threads_empty_stacktrace_ignored(self):
        for container in ["exception", "threads"]:
            event_data = {
                container: {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "stacktrace": {},
                        },
                    ],
                },
            }
            assert (
                has_stacktrace(event_data) is False
            ), f"Mistakenly detected stacktrace in `{container}`"

    def test_exception_or_threads_empty_frames_ignored(self):
        for container in ["exception", "threads"]:
            event_data = {
                container: {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "stacktrace": {
                                "frames": [],
                            },
                        },
                    ],
                },
            }
            assert (
                has_stacktrace(event_data) is False
            ), f"Mistakenly detected stacktrace in `{container}`"

    def test_exception_or_threads_no_stacktrace(self):
        for container in ["exception", "threads"]:
            event_data = {
                container: {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                        },
                    ],
                },
            }
            assert (
                has_stacktrace(event_data) is False
            ), f"Mistakenly detected stacktrace in `{container}`"

    def test_no_stacktrace_anywhere(self):
        event_data = {"event_id": 11212012123120120415201309082013}
        assert has_stacktrace(event_data) is False


@region_silo_test
class IsHandledTest(TestCase):
    def test_simple(self):
        for handled in [True, False]:
            event_data = {
                "exception": {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "mechanism": {"handled": handled},
                        }
                    ]
                },
            }

        assert is_handled(event_data) is handled

    def test_no_handled_value(self):
        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "MissingBallError",
                        "value": "Ball went over a fence",
                    }
                ]
            },
        }

        assert is_handled(event_data) is None

    def test_multiple_values_matching(self):
        for handled in [True, False]:
            event_data = {
                "exception": {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "mechanism": {"handled": handled},
                        },
                        {
                            "type": "ChewedUpShoeError",
                            "value": "Man, and I *liked* those flip-flops, too. :(",
                            "mechanism": {"handled": handled},
                        },
                    ]
                },
            }

            assert is_handled(event_data) is handled

    def test_multiple_values_mixed(self):
        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "MissingBallError",
                        "value": "Ball went over a fence",
                        "mechanism": {"handled": True},
                    },
                    {
                        "type": "ChewedUpShoeError",
                        "value": "Man, and I *liked* those flip-flops, too. :(",
                        "mechanism": {"handled": False},
                    },
                ]
            },
        }

        assert is_handled(event_data) is False

    def test_not_all_values_have_handled(self):
        for handled in [True, False]:
            event_data = {
                "exception": {
                    "values": [
                        {
                            "type": "MissingBallError",
                            "value": "Ball went over a fence",
                            "mechanism": {"handled": handled},
                        },
                        {
                            "type": "ChewedUpShoeError",
                            "value": "Man, and I *liked* those flip-flops, too. :(",
                        },
                        {
                            "type": "RolledInMudError",
                            "value": "Time for a bath",
                            "mechanism": {"source": "swamp"},
                        },
                    ]
                },
            }

            assert is_handled(event_data) is handled
