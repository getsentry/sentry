import copy
from collections.abc import Callable
from typing import Any, Literal, cast
from unittest.mock import patch

from sentry.eventstore.models import Event
from sentry.grouping.api import get_contributing_variant_and_component
from sentry.grouping.variants import CustomFingerprintVariant
from sentry.seer.similarity.utils import (
    BASE64_ENCODED_PREFIXES,
    MAX_FRAME_COUNT,
    ReferrerOptions,
    _is_snipped_context_line,
    filter_null_from_string,
    get_stacktrace_string,
    has_too_many_contributing_frames,
)
from sentry.testutils.cases import TestCase


class GetStacktraceStringTest(TestCase):
    EXPECTED_STACKTRACE_STRING = 'ZeroDivisionError: division by zero\n  File "python_onboarding.py", function divide_by_zero\n    divide = 1/0'
    BASE_APP_DATA: dict[str, Any] = {
        "app": {
            "type": "component",
            "description": "in-app",
            "hash": "hash",
            "component": {
                "id": "app",
                "name": "in-app",
                "contributes": True,
                "hint": None,
                "values": [
                    {
                        "id": "exception",
                        "name": "exception",
                        "contributes": True,
                        "hint": None,
                        "values": [
                            {
                                "id": "stacktrace",
                                "name": "stack-trace",
                                "contributes": True,
                                "hint": None,
                                "values": [
                                    {
                                        "id": "frame",
                                        "name": None,
                                        "contributes": True,
                                        "hint": None,
                                        "values": [
                                            {
                                                "id": "module",
                                                "name": None,
                                                "contributes": True,
                                                "hint": None,
                                                "values": ["__main__"],
                                            },
                                            {
                                                "id": "filename",
                                                "name": None,
                                                "contributes": False,
                                                "hint": None,
                                                "values": ["python_onboarding.py"],
                                            },
                                            {
                                                "id": "function",
                                                "name": None,
                                                "contributes": True,
                                                "hint": None,
                                                "values": ["divide_by_zero"],
                                            },
                                            {
                                                "id": "context-line",
                                                "name": None,
                                                "contributes": True,
                                                "hint": None,
                                                "values": ["divide = 1/0"],
                                            },
                                        ],
                                    }
                                ],
                            },
                            {
                                "id": "type",
                                "name": None,
                                "contributes": True,
                                "hint": None,
                                "values": ["ZeroDivisionError"],
                            },
                            {
                                "id": "value",
                                "name": None,
                                "contributes": False,
                                "hint": None,
                                "values": ["division by zero"],
                            },
                        ],
                    }
                ],
            },
        }
    }

    CHAINED_APP_DATA: dict[str, Any] = {
        "app": {
            "type": "component",
            "description": "in-app",
            "hash": "hash",
            "component": {
                "id": "app",
                "name": "in-app",
                "contributes": True,
                "hint": None,
                "values": [
                    {
                        "id": "chained-exception",
                        "name": None,
                        "contributes": True,
                        "hint": None,
                        "values": [
                            {
                                "id": "exception",
                                "name": "exception",
                                "contributes": True,
                                "hint": None,
                                "values": [
                                    {
                                        "id": "stacktrace",
                                        "name": "stack-trace",
                                        "contributes": True,
                                        "hint": None,
                                        "values": [
                                            {
                                                "id": "frame",
                                                "name": None,
                                                "contributes": True,
                                                "hint": None,
                                                "values": [
                                                    {
                                                        "id": "module",
                                                        "name": None,
                                                        "contributes": True,
                                                        "hint": None,
                                                        "values": ["__main__"],
                                                    },
                                                    {
                                                        "id": "filename",
                                                        "name": None,
                                                        "contributes": False,
                                                        "hint": None,
                                                        "values": ["python_onboarding.py"],
                                                    },
                                                    {
                                                        "id": "function",
                                                        "name": None,
                                                        "contributes": True,
                                                        "hint": None,
                                                        "values": ["divide_by_zero"],
                                                    },
                                                    {
                                                        "id": "context-line",
                                                        "name": None,
                                                        "contributes": True,
                                                        "hint": None,
                                                        "values": ["divide = 1/0"],
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                    {
                                        "id": "type",
                                        "name": None,
                                        "contributes": True,
                                        "hint": None,
                                        "values": ["ZeroDivisionError"],
                                    },
                                    {
                                        "id": "value",
                                        "name": None,
                                        "contributes": False,
                                        "hint": None,
                                        "values": ["division by zero"],
                                    },
                                ],
                            },
                            {
                                "id": "exception",
                                "name": "exception",
                                "contributes": True,
                                "hint": None,
                                "values": [
                                    {
                                        "id": "stacktrace",
                                        "name": "stack-trace",
                                        "contributes": True,
                                        "hint": None,
                                        "values": [
                                            {
                                                "id": "frame",
                                                "name": None,
                                                "contributes": True,
                                                "hint": None,
                                                "values": [
                                                    {
                                                        "id": "module",
                                                        "name": None,
                                                        "contributes": True,
                                                        "hint": None,
                                                        "values": ["__main__"],
                                                    },
                                                    {
                                                        "id": "filename",
                                                        "name": None,
                                                        "contributes": False,
                                                        "hint": None,
                                                        "values": ["python_onboarding.py"],
                                                    },
                                                    {
                                                        "id": "function",
                                                        "name": None,
                                                        "contributes": True,
                                                        "hint": None,
                                                        "values": ["<module>"],
                                                    },
                                                    {
                                                        "id": "context-line",
                                                        "name": None,
                                                        "contributes": True,
                                                        "hint": None,
                                                        "values": ["divide_by_zero()"],
                                                    },
                                                ],
                                            },
                                            {
                                                "id": "frame",
                                                "name": None,
                                                "contributes": True,
                                                "hint": None,
                                                "values": [
                                                    {
                                                        "id": "module",
                                                        "name": None,
                                                        "contributes": True,
                                                        "hint": None,
                                                        "values": ["__main__"],
                                                    },
                                                    {
                                                        "id": "filename",
                                                        "name": None,
                                                        "contributes": False,
                                                        "hint": None,
                                                        "values": ["python_onboarding.py"],
                                                    },
                                                    {
                                                        "id": "function",
                                                        "name": None,
                                                        "contributes": True,
                                                        "hint": None,
                                                        "values": ["divide_by_zero"],
                                                    },
                                                    {
                                                        "id": "context-line",
                                                        "name": None,
                                                        "contributes": True,
                                                        "hint": None,
                                                        "values": [
                                                            'raise Exception("Catch divide by zero error")'
                                                        ],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                    {
                                        "id": "type",
                                        "name": None,
                                        "contributes": True,
                                        "hint": None,
                                        "values": ["Exception"],
                                    },
                                    {
                                        "id": "value",
                                        "name": None,
                                        "contributes": False,
                                        "hint": None,
                                        "values": ["Catch divide by zero error"],
                                    },
                                ],
                            },
                        ],
                    }
                ],
            },
        }
    }

    MOBILE_THREAD_DATA: dict[str, Any] = {
        "app": {
            "type": "component",
            "description": "in-app thread stack-trace",
            "hash": "hash",
            "component": {
                "id": "app",
                "name": "in-app",
                "contributes": True,
                "hint": None,
                "values": [
                    {
                        "id": "threads",
                        "name": "thread",
                        "contributes": True,
                        "hint": None,
                        "values": [
                            {
                                "id": "stacktrace",
                                "name": "stack-trace",
                                "contributes": True,
                                "hint": None,
                                "values": [
                                    {
                                        "id": "frame",
                                        "name": None,
                                        "contributes": True,
                                        "hint": "marked out of app by stack trace rule (function:dbx v-group -group v-app -app)",
                                        "values": [
                                            {
                                                "id": "module",
                                                "name": None,
                                                "contributes": True,
                                                "hint": None,
                                                "values": ["module"],
                                            },
                                            {
                                                "id": "filename",
                                                "name": None,
                                                "contributes": True,
                                                "hint": None,
                                                "values": ["filename"],
                                            },
                                            {
                                                "id": "function",
                                                "name": None,
                                                "contributes": True,
                                                "hint": "ignored unknown function",
                                                "values": ["TestHandler"],
                                            },
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ],
            },
        }
    }

    ONLY_STACKTRACE = {
        "app": {
            "hash": "foo",
            "component": {
                "id": "app",
                "contributes": True,
                "values": [
                    {
                        "id": "stacktrace",
                        "contributes": True,
                        "values": [
                            {
                                "id": "frame",
                                "contributes": True,
                                "values": [
                                    {
                                        "id": "filename",
                                        "contributes": True,
                                        "values": ["index.php"],
                                    },
                                    {
                                        "id": "context-line",
                                        "contributes": True,
                                        "values": ["$server->emit($server->run());"],
                                    },
                                ],
                            }
                        ],
                    }
                ],
            },
        }
    }

    def create_exception(
        self,
        exception_type_str: str = "Exception",
        exception_value: str = "it broke",
        frames: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        frames = frames or []
        return {
            "id": "exception",
            "name": "exception",
            "contributes": True,
            "hint": None,
            "values": [
                {
                    "id": "stacktrace",
                    "name": "stack-trace",
                    "contributes": True,
                    "hint": None,
                    "values": frames,
                },
                {
                    "id": "type",
                    "name": None,
                    "contributes": True,
                    "hint": None,
                    "values": [exception_type_str],
                },
                {
                    "id": "value",
                    "name": None,
                    "contributes": False,
                    "hint": None,
                    "values": [exception_value],
                },
            ],
        }

    def create_frames(
        self,
        num_frames: int,
        contributes: bool = True,
        start_index: int = 1,
        context_line_factory: Callable[[int], str] = lambda i: f"test = {i}!",
        minified_frames: Literal["all", "some", "none"] = "none",
    ) -> list[dict[str, Any]]:
        if minified_frames == "all":
            make_context_line = lambda i: "{snip}" + context_line_factory(i) + "{snip}"
        elif minified_frames == "some":
            make_context_line = lambda i: (
                "{snip}" + context_line_factory(i) + "{snip}"
                if i % 2 == 0
                else context_line_factory(i)
            )
        else:
            make_context_line = context_line_factory

        frames = []
        for i in range(start_index, start_index + num_frames):
            frames.append(
                {
                    "id": "frame",
                    "name": None,
                    "contributes": contributes,
                    "hint": None,
                    "values": [
                        {
                            "id": "filename",
                            "name": None,
                            "contributes": contributes,
                            "hint": None,
                            "values": ["hello.py"],
                        },
                        {
                            "id": "function",
                            "name": None,
                            "contributes": contributes,
                            "hint": None,
                            "values": ["hello_there"],
                        },
                        {
                            "id": "context-line",
                            "name": None,
                            "contributes": contributes,
                            "hint": None,
                            "values": [make_context_line(i)],
                        },
                    ],
                }
            )
        return frames

    def test_simple(self):
        stacktrace_str = get_stacktrace_string(self.BASE_APP_DATA)
        assert stacktrace_str == self.EXPECTED_STACKTRACE_STRING

    def test_no_values(self):
        stacktrace_string = get_stacktrace_string({})
        assert stacktrace_string == ""

    def test_contributing_exception_no_frames(self):
        data_non_contributing_frame = copy.deepcopy(self.BASE_APP_DATA)
        data_non_contributing_frame["app"]["component"]["values"][0]["values"][0]["values"] = []
        stacktrace_str = get_stacktrace_string(data_non_contributing_frame)
        assert stacktrace_str == "ZeroDivisionError: division by zero"

    def test_contributing_exception_no_contributing_frames(self):
        data_no_contributing_frame = copy.deepcopy(self.BASE_APP_DATA)
        data_no_contributing_frame["app"]["component"]["values"][0]["values"][0]["values"] = (
            self.create_frames(1, False)
        )
        stacktrace_str = get_stacktrace_string(data_no_contributing_frame)
        assert stacktrace_str == "ZeroDivisionError: division by zero"

    def test_no_contributing_exception(self):
        data_no_contributing_frame = copy.deepcopy(self.BASE_APP_DATA)
        data_no_contributing_frame["app"]["component"]["values"][0]["contributes"] = False
        stacktrace_str = get_stacktrace_string(data_no_contributing_frame)
        assert stacktrace_str == ""

    def test_non_contributing_frame(self):
        data_non_contributing_frame = copy.deepcopy(self.BASE_APP_DATA)
        data_non_contributing_frame["app"]["component"]["values"][0]["values"][0][
            "values"
        ] += self.create_frames(1, False)
        stacktrace_str = get_stacktrace_string(data_non_contributing_frame)
        assert stacktrace_str == self.EXPECTED_STACKTRACE_STRING

    def test_no_stacktrace(self):
        data_no_stacktrace = copy.deepcopy(self.BASE_APP_DATA)
        data_no_stacktrace["app"]["component"]["values"].pop(0)
        stacktrace_str = get_stacktrace_string(data_no_stacktrace)
        assert stacktrace_str == ""

    def test_chained(self):
        stacktrace_str = get_stacktrace_string(self.CHAINED_APP_DATA)
        expected_stacktrace_str = (
            'Exception: Catch divide by zero error\n  File "python_onboarding.py", function <module>\n    divide_by_zero()\n  File "python_onboarding.py", function divide_by_zero\n    raise Exception("Catch divide by zero error")\n'
            + self.EXPECTED_STACKTRACE_STRING
        )
        assert stacktrace_str == expected_stacktrace_str

    def test_chained_stacktrace_truncation(self):
        data_chained_exception = copy.deepcopy(self.CHAINED_APP_DATA)
        data_chained_exception["app"]["component"]["values"][0]["values"] = [
            self.create_exception(
                exception_type_str="InnerException",
                exception_value="nope",
                frames=self.create_frames(
                    num_frames=25, context_line_factory=lambda i: f"inner line {i}"
                ),
            ),
            self.create_exception(
                exception_type_str="MiddleException",
                exception_value="un-uh",
                frames=self.create_frames(
                    num_frames=25, context_line_factory=lambda i: f"middle line {i}"
                ),
            ),
            self.create_exception(
                exception_type_str="OuterException",
                exception_value="no way",
                frames=self.create_frames(
                    num_frames=25, context_line_factory=lambda i: f"outer line {i}"
                ),
            ),
        ]
        stacktrace_str = get_stacktrace_string(data_chained_exception)

        # The stacktrace string should be:
        #    25 frames from OuterExcepton (with lines counting up from 1 to 25), followed by
        #    5 frames from MiddleExcepton (with lines counting up from 21 to 25), followed by
        #    no frames from InnerExcepton (though the type and value are in there)
        expected = "".join(
            ["OuterException: no way"]
            + [
                f'\n  File "hello.py", function hello_there\n    outer line {i}'
                for i in range(1, 26)  #
            ]
            + ["\nMiddleException: un-uh"]
            + [
                f'\n  File "hello.py", function hello_there\n    middle line {i}'
                for i in range(21, 26)
            ]
            + ["\nInnerException: nope"]
        )
        assert stacktrace_str == expected

    def test_chained_stacktrace_truncation_all_minified_js(self):
        data_chained_exception = copy.deepcopy(self.CHAINED_APP_DATA)
        data_chained_exception["app"]["component"]["values"][0]["values"] = [
            self.create_exception(
                exception_type_str="InnerException",
                exception_value="nope",
                frames=self.create_frames(
                    num_frames=15,
                    context_line_factory=lambda i: f"inner line {i}",
                    minified_frames="all",
                ),
            ),
            self.create_exception(
                exception_type_str="MiddleException",
                exception_value="un-uh",
                frames=self.create_frames(
                    num_frames=15,
                    context_line_factory=lambda i: f"middle line {i}",
                    minified_frames="all",
                ),
            ),
            self.create_exception(
                exception_type_str="OuterException",
                exception_value="no way",
                frames=self.create_frames(
                    num_frames=15,
                    context_line_factory=lambda i: f"outer line {i}",
                    minified_frames="all",
                ),
            ),
        ]
        stacktrace_str = get_stacktrace_string(data_chained_exception)

        # The stacktrace string should be:
        #    15 frames from OuterExcepton (with lines counting up from 1 to 15), followed by
        #    5 frames from MiddleExcepton (with lines counting up from 11 to 15), followed by
        #    no frames from InnerExcepton (though the type and value are in there)
        expected = "".join(
            ["OuterException: no way"]
            + [
                f'\n  File "hello.py", function hello_there\n    {{snip}}outer line {i}{{snip}}'
                for i in range(1, 16)
            ]
            + ["\nMiddleException: un-uh"]
            + [
                f'\n  File "hello.py", function hello_there\n    {{snip}}middle line {i}{{snip}}'
                for i in range(11, 16)
            ]
            + ["\nInnerException: nope"]
        )
        assert stacktrace_str == expected

    def test_chained_stacktrace_truncation_minified_js_frame_limit_is_lower(self):
        """Test that we restrict fully-minified stacktraces to 20 frames, and all other stacktraces to 30 frames."""
        for minified_frames, expected_frame_count in [("all", 20), ("some", 30), ("none", 30)]:
            data_chained_exception = copy.deepcopy(self.CHAINED_APP_DATA)
            data_chained_exception["app"]["component"]["values"][0]["values"] = [
                self.create_exception(
                    exception_type_str="InnerException",
                    exception_value="nope",
                    frames=self.create_frames(
                        num_frames=25,
                        context_line_factory=lambda i: f"inner line {i}",
                        minified_frames=cast(Literal["all", "some", "none"], minified_frames),
                    ),
                ),
                self.create_exception(
                    exception_type_str="MiddleException",
                    exception_value="un-uh",
                    frames=self.create_frames(
                        num_frames=25,
                        context_line_factory=lambda i: f"middle line {i}",
                        minified_frames=cast(Literal["all", "some", "none"], minified_frames),
                    ),
                ),
                self.create_exception(
                    exception_type_str="OuterException",
                    exception_value="no way",
                    frames=self.create_frames(
                        num_frames=25,
                        context_line_factory=lambda i: f"outer line {i}",
                        minified_frames=cast(Literal["all", "some", "none"], minified_frames),
                    ),
                ),
            ]
            stacktrace_str = get_stacktrace_string(data_chained_exception)

            assert (
                stacktrace_str.count("outer line")
                + stacktrace_str.count("middle line")
                + stacktrace_str.count("inner line")
                == expected_frame_count
            )

    def test_chained_exception_limit(self):
        """Test that we restrict number of chained exceptions to MAX_FRAME_COUNT."""
        data_chained_exception = copy.deepcopy(self.CHAINED_APP_DATA)
        data_chained_exception["app"]["component"]["values"][0]["values"] = [
            self.create_exception(
                exception_type_str="Exception",
                exception_value=f"exception {i} message!",
                frames=self.create_frames(num_frames=1, context_line_factory=lambda i: f"line {i}"),
            )
            for i in range(1, MAX_FRAME_COUNT + 2)
        ]
        stacktrace_str = get_stacktrace_string(data_chained_exception)
        for i in range(2, MAX_FRAME_COUNT + 2):
            assert f"exception {i} message!" in stacktrace_str
        assert "exception 1 message!" not in stacktrace_str

    def test_thread(self):
        stacktrace_str = get_stacktrace_string(self.MOBILE_THREAD_DATA)
        assert stacktrace_str == 'File "filename", function TestHandler'

    def test_system(self):
        data_system = copy.deepcopy(self.BASE_APP_DATA)
        data_system["system"] = data_system.pop("app")
        stacktrace_str = get_stacktrace_string(data_system)
        assert stacktrace_str == self.EXPECTED_STACKTRACE_STRING

    def test_app_and_system(self):
        data = copy.deepcopy(self.BASE_APP_DATA)
        data_system = copy.deepcopy(self.BASE_APP_DATA)
        data_system = data_system.pop("app")
        data_system["component"]["values"][0]["values"][0]["values"] = self.create_frames(1, True)
        data.update({"system": data_system})

        stacktrace_str = get_stacktrace_string(data)
        assert stacktrace_str == self.EXPECTED_STACKTRACE_STRING

    def test_no_app_no_system(self):
        data = {"default": "something"}
        stacktrace_str = get_stacktrace_string(data)
        assert stacktrace_str == ""

    def test_stacktrace_truncation_uses_in_app_contributing_frames(self):
        """
        Check that when there are over MAX_FRAME_COUNT contributing frames, the last MAX_FRAME_COUNT
        is included.
        """
        data_frames = copy.deepcopy(self.BASE_APP_DATA)
        # Create 30 contributing frames, 1-20 -> last 10 should be included
        data_frames["app"]["component"]["values"][0]["values"][0]["values"] = self.create_frames(
            20, True
        )
        # Create 20 non-contributing frames, 21-40 -> none should be included
        data_frames["app"]["component"]["values"][0]["values"][0]["values"] += self.create_frames(
            20, False, 21
        )
        # Create 20 contributing frames, 41-60 -> all should be included
        data_frames["app"]["component"]["values"][0]["values"][0]["values"] += self.create_frames(
            20, True, 41
        )
        stacktrace_str = get_stacktrace_string(data_frames)

        num_frames = 0
        for i in range(1, 11):
            assert ("test = " + str(i) + "!") not in stacktrace_str
        for i in range(11, 21):
            num_frames += 1
            assert ("test = " + str(i) + "!") in stacktrace_str
        for i in range(21, 41):
            assert ("test = " + str(i) + "!") not in stacktrace_str
        for i in range(41, 61):
            num_frames += 1
            assert ("test = " + str(i) + "!") in stacktrace_str
        assert num_frames == MAX_FRAME_COUNT

    def test_stacktrace_truncation_minified_js_frame_limit_is_lower(self):
        """Test that we restrict fully-minified stacktraces to 20 frames, and all other stacktraces to 30 frames."""
        for minified_frames, expected_frame_count in [("all", 20), ("some", 30), ("none", 30)]:
            data_frames = copy.deepcopy(self.BASE_APP_DATA)
            data_frames["app"]["component"]["values"] = [
                self.create_exception(
                    frames=self.create_frames(
                        num_frames=40,
                        context_line_factory=lambda i: f"context line {i}",
                        minified_frames=cast(Literal["all", "some", "none"], minified_frames),
                    ),
                ),
            ]
            stacktrace_str = get_stacktrace_string(data_frames)

            assert stacktrace_str.count("context line") == expected_frame_count

    def test_no_exception(self):
        data_no_exception = copy.deepcopy(self.BASE_APP_DATA)
        data_no_exception["app"]["component"]["values"][0]["id"] = "not-exception"
        stacktrace_str = get_stacktrace_string(data_no_exception)
        assert stacktrace_str == ""

    def test_recognizes_snip_at_start_or_end(self):
        assert _is_snipped_context_line("{snip} dogs are great") is True
        assert _is_snipped_context_line("dogs are great {snip}") is True
        assert _is_snipped_context_line("{snip} dogs are great {snip}") is True
        assert _is_snipped_context_line("dogs are great") is False

    def test_only_frame_base64_encoded_filename(self):
        for base64_prefix in BASE64_ENCODED_PREFIXES:
            base64_filename = f"{base64_prefix} extra content that could be long and useless"
            data_base64_encoded_filename = copy.deepcopy(self.BASE_APP_DATA)
            data_base64_encoded_filename["app"]["component"]["values"][0]["values"][0]["values"][0][
                "values"
            ][1]["values"][0] = base64_filename
            stacktrace_str = get_stacktrace_string(data_base64_encoded_filename)
            assert stacktrace_str == "ZeroDivisionError: division by zero"

    def test_only_stacktrace_frames(self):
        stacktrace_str = get_stacktrace_string(self.ONLY_STACKTRACE)
        assert stacktrace_str == 'File "index.php", function \n    $server->emit($server->run());'

    def test_replace_file_with_module(self):
        exception = copy.deepcopy(self.BASE_APP_DATA)
        # delete filename from the exception
        del exception["app"]["component"]["values"][0]["values"][0]["values"][0]["values"][1]
        stacktrace_string = get_stacktrace_string(exception)
        assert (
            stacktrace_string
            == 'ZeroDivisionError: division by zero\n  File "__main__", function divide_by_zero\n    divide = 1/0'
        )

    def test_no_filename_or_module(self):
        exception = copy.deepcopy(self.BASE_APP_DATA)
        # delete module from the exception
        del exception["app"]["component"]["values"][0]["values"][0]["values"][0]["values"][0]
        # delete filename from the exception
        del exception["app"]["component"]["values"][0]["values"][0]["values"][0]["values"][0]
        stacktrace_string = get_stacktrace_string(exception)
        assert (
            stacktrace_string
            == 'ZeroDivisionError: division by zero\n  File "None", function divide_by_zero\n    divide = 1/0'
        )

    @patch("sentry.seer.similarity.utils.metrics")
    def test_no_header_one_frame_no_filename(self, mock_metrics):
        exception = copy.deepcopy(self.MOBILE_THREAD_DATA)
        # Remove filename
        exception["app"]["component"]["values"][0]["values"][0]["values"][0]["values"][1][
            "values"
        ] = []
        assert get_stacktrace_string(exception) == ""


class SeerUtilsTest(TestCase):
    def test_filter_null_from_string(self):
        string_with_null = 'String with null \x00, "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00" is null'
        assert filter_null_from_string(string_with_null) == 'String with null , "" is null'


class HasTooManyFramesTest(TestCase):
    def setUp(self):
        # The `in_app` and `contributes` values of these frames will be determined by the project
        # stacktrace rules we'll add below
        self.contributing_system_frame = {
            "function": "handleRequest",
            "filename": "/node_modules/express/router.js",
            "context_line": "return handler(request);",
        }
        self.non_contributing_system_frame = {
            "function": "runApp",
            "filename": "/node_modules/express/app.js",
            "context_line": "return server.serve(port);",
        }
        self.contributing_in_app_frame = {
            "function": "playFetch",
            "filename": "/dogApp/dogpark.js",
            "context_line": "raise FailedToFetchError('Charlie didn't bring the ball back');",
        }
        self.non_contributing_in_app_frame = {
            "function": "recordMetrics",
            "filename": "/dogApp/metrics.js",
            "context_line": "return withMetrics(handler, metricName, tags);",
        }
        self.exception_value = {
            "type": "FailedToFetchError",
            "value": "Charlie didn't bring the ball back",
        }
        self.event = Event(
            event_id="12312012041520130908201311212012",
            project_id=self.project.id,
            data={
                "title": "FailedToFetchError('Charlie didn't bring the ball back')",
                "exception": {"values": [self.exception_value]},
            },
        )
        self.project.update_option(
            "sentry:grouping_enhancements",
            "\n".join(
                [
                    "stack.function:runApp -app -group",
                    "stack.function:handleRequest -app +group",
                    "stack.function:recordMetrics +app -group",
                    "stack.function:playFetch +app +group",
                ]
            ),
        )

    def test_single_exception_simple(self):
        for stacktrace_length, expected_result in [
            (MAX_FRAME_COUNT - 1, False),
            (MAX_FRAME_COUNT + 1, True),
        ]:
            self.event.data["platform"] = "java"
            self.event.data["exception"]["values"][0]["stacktrace"] = {
                "frames": [self.contributing_in_app_frame] * stacktrace_length
            }

            # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
            variants = self.event.get_grouping_variants(normalize_stacktraces=True)

            assert (
                has_too_many_contributing_frames(self.event, variants, ReferrerOptions.INGEST)
                is expected_result
            )

    def test_single_exception_bypassed_platform(self):
        # Regardless of the number of frames, we never flag it as being too long
        for stacktrace_length, expected_result in [
            (MAX_FRAME_COUNT - 1, False),
            (MAX_FRAME_COUNT + 1, False),
        ]:
            self.event.data["platform"] = "python"
            self.event.data["exception"]["values"][0]["stacktrace"] = {
                "frames": [self.contributing_in_app_frame] * stacktrace_length
            }

            # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
            variants = self.event.get_grouping_variants(normalize_stacktraces=True)

            assert (
                has_too_many_contributing_frames(self.event, variants, ReferrerOptions.INGEST)
                is expected_result
            )

    def test_chained_exception_simple(self):
        for total_frames, expected_result in [
            (MAX_FRAME_COUNT - 2, False),
            (MAX_FRAME_COUNT + 2, True),
        ]:
            self.event.data["platform"] = "java"
            self.event.data["exception"]["values"] = [
                {**self.exception_value},
                {**self.exception_value},
            ]
            self.event.data["exception"]["values"][0]["stacktrace"] = {
                "frames": [self.contributing_in_app_frame] * (total_frames // 2)
            }
            self.event.data["exception"]["values"][1]["stacktrace"] = {
                "frames": [self.contributing_in_app_frame] * (total_frames // 2)
            }

            # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
            variants = self.event.get_grouping_variants(normalize_stacktraces=True)

            assert (
                has_too_many_contributing_frames(self.event, variants, ReferrerOptions.INGEST)
                is expected_result
            )

    def test_chained_exception_bypassed_platform(self):
        # Regardless of the number of frames, we never flag it as being too long
        for total_frames, expected_result in [
            (MAX_FRAME_COUNT - 2, False),
            (MAX_FRAME_COUNT + 2, False),
        ]:
            self.event.data["platform"] = "python"
            self.event.data["exception"]["values"] = [
                {**self.exception_value},
                {**self.exception_value},
            ]
            self.event.data["exception"]["values"][0]["stacktrace"] = {
                "frames": [self.contributing_in_app_frame] * (total_frames // 2)
            }
            self.event.data["exception"]["values"][1]["stacktrace"] = {
                "frames": [self.contributing_in_app_frame] * (total_frames // 2)
            }

            # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
            variants = self.event.get_grouping_variants(normalize_stacktraces=True)

            assert (
                has_too_many_contributing_frames(self.event, variants, ReferrerOptions.INGEST)
                is expected_result
            )

    def test_ignores_non_contributing_frames(self):
        self.event.data["platform"] = "java"
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": (
                # Taken together, there are too many frames
                [self.contributing_in_app_frame] * (MAX_FRAME_COUNT - 1)
                + [self.non_contributing_in_app_frame] * 2
            )
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        assert (
            has_too_many_contributing_frames(self.event, variants, ReferrerOptions.INGEST)
            is False  # Not flagged as too many because only contributing frames are counted
        )

    def test_prefers_app_frames(self):
        self.event.data["platform"] = "java"
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": (
                [self.contributing_in_app_frame] * (MAX_FRAME_COUNT - 1)  # Under the limit
                + [self.contributing_system_frame] * (MAX_FRAME_COUNT + 1)  # Over the limit
            )
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        assert (
            has_too_many_contributing_frames(self.event, variants, ReferrerOptions.INGEST)
            is False  # Not flagged as too many because only in-app frames are counted
        )

    def test_uses_app_or_system_variants(self):
        for frame, expected_variant_name in [
            (self.contributing_in_app_frame, "app"),
            (self.contributing_system_frame, "system"),
        ]:
            self.event.data["platform"] = "java"
            self.event.data["exception"]["values"][0]["stacktrace"] = {
                "frames": [frame] * (MAX_FRAME_COUNT + 1)
            }

            # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
            variants = self.event.get_grouping_variants(normalize_stacktraces=True)

            contributing_variant, _ = get_contributing_variant_and_component(variants)
            assert contributing_variant.variant_name == expected_variant_name

            assert (
                has_too_many_contributing_frames(self.event, variants, ReferrerOptions.INGEST)
                is True
            )

    def test_ignores_events_not_grouped_on_stacktrace(self):
        self.event.data["platform"] = "java"
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": ([self.contributing_system_frame] * (MAX_FRAME_COUNT + 1))  # Over the limit
        }
        self.event.data["fingerprint"] = ["dogs_are_great"]

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)
        contributing_variant, _ = get_contributing_variant_and_component(variants)
        assert isinstance(contributing_variant, CustomFingerprintVariant)

        assert (
            has_too_many_contributing_frames(self.event, variants, ReferrerOptions.INGEST)
            is False  # Not flagged as too many because it's grouped by fingerprint
        )
