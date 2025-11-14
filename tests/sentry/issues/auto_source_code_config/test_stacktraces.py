from typing import int, Any

import pytest

from sentry.issues.auto_source_code_config.stacktraces import get_frames_to_process


def _exception_with_stacktrace(frames: list[dict[str, Any]]) -> dict[str, Any]:
    return {"exception": {"values": [{"stacktrace": {"frames": frames}}]}}


def _stacktrace(frames: list[dict[str, Any]]) -> dict[str, Any]:
    return {"stacktrace": {"frames": frames}}


BASIC_FRAME = {"in_app": True, "filename": "foo"}


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
        pytest.param(
            [
                # These frames are excluded because they have been categorized
                {"module": "android.app", "in_app": False, "data": {"category": "foo"}},
                {"module": "android.app", "in_app": False, "data": {"category": None}},
                # These frames will be considered since they don't have a category set
                {"module": "android.app", "in_app": False, "data": {}},
                {"module": "android.app", "in_app": False, "data": None},
                {"module": "com.example.foo", "in_app": False, "data": {}},
                {"module": "com.example.bar", "in_app": False},
            ],
            "java",
            [
                # These will be considered since they don't have a category set
                {"module": "android.app", "in_app": False, "data": {}},
                {"module": "android.app", "in_app": False, "data": None},
                {"module": "com.example.foo", "in_app": False, "data": {}},
                {"module": "com.example.bar", "in_app": False},
            ],
            id="java_module_with_category",
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
        (None, []),
        ([None], []),
        ([], []),
        ([{"in_app": True}], []),  # Both in_app and filename are required
        ([BASIC_FRAME, None], [BASIC_FRAME]),  # Handle intermixing of None and dicts
    ],
)
def test_with_invalid_frames(frames: list[dict[str, Any]], expected: list[str]) -> None:
    frames = get_frames_to_process(_exception_with_stacktrace(frames), "python")
    assert frames == expected

    frames = get_frames_to_process(_stacktrace(frames), "python")
    assert frames == expected
