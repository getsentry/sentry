from typing import Any
from unittest import TestCase

from sentry.conf.server import WINTER_2023_GROUPING_CONFIG
from sentry.grouping.api import get_default_grouping_config_dict, load_grouping_config
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping


def _get_context_lines(event_data: dict[str, Any]) -> list[str]:
    frames = event_data["exception"]["values"][0]["stacktrace"]["frames"]
    return [frame["context_line"] for frame in frames]


class PythonMultiprocessingContextLineTest(TestCase):
    POSIX_MULTIPROCESSING_CONTEXT_LINE = (
        "from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=11, pipe_handle=21)"
    )
    WINDOWS_MULTIPROCESSING_CONTEXT_LINE = (
        "from multiprocessing.spawn import spawn_main; spawn_main(parent_pid=12, pipe_handle=31)"
    )

    def _make_event_data(self, context_lines: list[str], platform: str) -> dict[str, Any]:
        return {
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "module": "__main__",
                                    "filename": "<string>",
                                    "function": "<module>",
                                    "context_line": context_line,
                                }
                                for context_line in context_lines
                            ],
                        },
                    }
                ]
            },
            "platform": platform,
        }

    def test_no_parameterization_for_non_python_events(self) -> None:
        context_lines = [self.POSIX_MULTIPROCESSING_CONTEXT_LINE]
        event_data = self._make_event_data(context_lines, "javascript")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_context_lines(event_data) == context_lines

    def test_no_parameterization_for_other_numbers_in_python_context_lines(self) -> None:
        context_lines = [
            "number_1_dog = 'maisey'",
            "charlie_is_co_number_1_dog = True",
            "maisey_dog_ranking = 1",
            "charlie_dog_ranking = 1",
        ]
        event_data = self._make_event_data(context_lines, "python")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_context_lines(event_data) == context_lines

    # TODO: This can go away once we're fully transitioned off of the `newstyle:2023-01-11` grouping
    # config
    def test_no_parameterization_under_2023_grouping_config(self) -> None:
        context_lines = [self.POSIX_MULTIPROCESSING_CONTEXT_LINE]
        event_data = self._make_event_data(context_lines, "javascript")

        normalize_stacktraces_for_grouping(
            event_data,
            load_grouping_config(get_default_grouping_config_dict(WINTER_2023_GROUPING_CONFIG)),
        )

        assert _get_context_lines(event_data) == context_lines

    def test_parameterizes_python_multiprocess_spawn_calls_posix(self) -> None:
        context_lines = [self.POSIX_MULTIPROCESSING_CONTEXT_LINE]
        event_data = self._make_event_data(context_lines, "python")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_context_lines(event_data) == [
            "from multiprocessing.spawn import spawn_main; spawn_main(tracker_fd=<int>, pipe_handle=<int>)"
        ]

    def test_parameterizes_python_multiprocess_spawn_calls_windows(self) -> None:
        context_lines = [self.WINDOWS_MULTIPROCESSING_CONTEXT_LINE]
        event_data = self._make_event_data(context_lines, "python")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_context_lines(event_data) == [
            "from multiprocessing.spawn import spawn_main; spawn_main(parent_pid=<int>, pipe_handle=<int>)"
        ]
