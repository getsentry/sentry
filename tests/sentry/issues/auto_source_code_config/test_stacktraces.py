from typing import Any

import pytest

from sentry.issues.auto_source_code_config.stacktraces import get_frames_to_process


def _exception_with_stacktrace(frames: list[dict[str, Any]]) -> dict[str, Any]:
    return {"exception": {"values": [{"stacktrace": {"frames": frames}}]}}


@pytest.mark.parametrize(
    "frames, platform, expected",
    [
        pytest.param(
            [
                # Excluded because it's not in_app
                {"filename": "../node_modules/@foo/hub.js", "in_app": False},
                {"filename": "./app/utils/handle.tsx", "in_app": True},
                {"filename": "./app/utils/Test.tsx", "in_app": True},
            ],
            "javascript",
            [
                {"filename": "./app/utils/handle.tsx", "in_app": True},
                {"filename": "./app/utils/Test.tsx", "in_app": True},
            ],
            id="javascript_relative_paths_with_node_modules",
        ),
        pytest.param(
            [
                {"filename": "path/test.rb", "in_app": True},
                {"filename": "path/crontask.rake", "in_app": True},
            ],
            "ruby",
            [
                {"filename": "path/test.rb", "in_app": True},
                {"filename": "path/crontask.rake", "in_app": True},
            ],
            id="ruby_files_with_different_extensions",
        ),
        pytest.param(
            [
                {"filename": "app:///utils/errors.js", "in_app": True},
                {"filename": "../../packages/api/src/response.ts", "in_app": True},
                {"filename": "app:///../foo/bar/index.js", "in_app": True},
            ],
            "node",
            [
                {"filename": "app:///utils/errors.js", "in_app": True},
                {"filename": "../../packages/api/src/response.ts", "in_app": True},
                {"filename": "app:///../foo/bar/index.js", "in_app": True},
            ],
            id="node_app_protocol_and_relative_paths",
        ),
        pytest.param(
            [
                {"filename": "sentry/tasks.py", "in_app": True},
                {"filename": "sentry/models/release.py", "in_app": True},
            ],
            "python",
            [
                {"filename": "sentry/tasks.py", "in_app": True},
                {"filename": "sentry/models/release.py", "in_app": True},
            ],
            id="python_paths",
        ),
    ],
)
def test_get_frames_to_process(
    frames: list[dict[str, Any]], platform: str, expected: set[str]
) -> None:
    frames = get_frames_to_process(_exception_with_stacktrace(frames), platform)
    assert frames == expected


@pytest.mark.parametrize(
    "frames, expected",
    [
        ([], []),
        ([{"in_app": True}], []),
    ],
)
def test_find_stacktrace_empty(frames: list[dict[str, Any]], expected: list[str]) -> None:
    frames = get_frames_to_process(_exception_with_stacktrace(frames))
    assert frames == expected
