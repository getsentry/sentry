from typing import Any

import pytest

from sentry.issues.auto_source_code_config.stacktraces import get_frames_to_process


def _exception_with_stacktrace(frames: list[dict[str, Any]]) -> dict[str, Any]:
    return {"exception": {"values": [{"stacktrace": {"frames": frames}}]}}


@pytest.mark.parametrize(
    "frames, expected",
    [
        ([], []),
        ([None], []),
        ([{"in_app": True}], []),
    ],
)
def test_find_stacktrace_empty(frames: list[dict[str, Any]], expected: list[str]) -> None:
    frames = get_frames_to_process(_exception_with_stacktrace(frames))
    assert frames == expected
