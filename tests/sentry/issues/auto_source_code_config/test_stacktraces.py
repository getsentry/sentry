from typing import Any

import pytest

from sentry.issues.auto_source_code_config.stacktraces import Stacktrace, identify_stacktrace_paths


def _stacktrace_with_frames(frames: list[dict[str, Any]]) -> Stacktrace:
    return {"stacktrace": {"frames": frames}}


@pytest.mark.parametrize(
    "stacktrace, expected",
    [
        pytest.param(
            _stacktrace_with_frames(
                [
                    {"filename": "../node_modules/@foo/hub.js", "in_app": False},
                    {"filename": "./app/utils/handle.tsx", "in_app": True},
                    {"filename": "./app/utils/Test.tsx", "in_app": True},
                ]
            ),
            {
                "./app/utils/handle.tsx",
                "./app/utils/Test.tsx",
            },
            id="javascript_relative_paths_with_node_modules",
        ),
        pytest.param(
            _stacktrace_with_frames(
                [
                    {"filename": "path/test.rb", "in_app": True},
                    {"filename": "path/crontask.rake", "in_app": True},
                ]
            ),
            {"path/test.rb", "path/crontask.rake"},
            id="ruby_files_with_different_extensions",
        ),
        pytest.param(
            _stacktrace_with_frames(
                [
                    {"filename": "app:///utils/errors.js", "in_app": True},
                    {"filename": "../../packages/api/src/response.ts", "in_app": True},
                    {"filename": "app:///../foo/bar/index.js", "in_app": True},
                ]
            ),
            {
                "app:///utils/errors.js",
                "../../packages/api/src/response.ts",
                "app:///../foo/bar/index.js",
            },
            id="node_app_protocol_and_relative_paths",
        ),
        pytest.param(
            _stacktrace_with_frames(
                [
                    {"filename": "sentry/tasks.py", "in_app": True},
                    {"filename": "sentry/models/release.py", "in_app": True},
                ]
            ),
            {
                "sentry/tasks.py",
                "sentry/models/release.py",
            },
            id="python_paths",
        ),
    ],
)
def test_identify_stacktrace_paths(stacktrace: Stacktrace, expected: set[str]) -> None:
    stacktrace_paths = identify_stacktrace_paths(stacktrace)
    assert set(stacktrace_paths) == expected


@pytest.mark.parametrize(
    "stacktrace, expected",
    [
        (_stacktrace_with_frames([]), []),
        (_stacktrace_with_frames([{"in_app": True}]), []),
    ],
)
def test_find_stacktrace_empty(stacktrace: Stacktrace, expected: list[str]) -> None:
    stacktrace_paths = identify_stacktrace_paths(stacktrace)
    assert stacktrace_paths == expected
