import pytest

from sentry.issues.auto_source_code_config.stacktraces import Frame, get_frames_to_process


@pytest.mark.parametrize(
    "frames, platform, expected",
    [
        pytest.param(
            [
                {"filename": "../node_modules/@foo/hub.js", "in_app": False},
                {"filename": "./app/utils/handle.tsx", "in_app": True},
                {"filename": "./app/utils/Test.tsx", "in_app": True},
            ],
            "javascript",
            {
                "./app/utils/handle.tsx",
                "./app/utils/Test.tsx",
            },
            id="javascript_relative_paths_with_node_modules",
        ),
        pytest.param(
            [
                {"filename": "path/test.rb", "in_app": True},
                {"filename": "path/crontask.rake", "in_app": True},
            ],
            "ruby",
            {"path/test.rb", "path/crontask.rake"},
            id="ruby_files_with_different_extensions",
        ),
        pytest.param(
            [
                {"filename": "app:///utils/errors.js", "in_app": True},
                {"filename": "../../packages/api/src/response.ts", "in_app": True},
                {"filename": "app:///../foo/bar/index.js", "in_app": True},
            ],
            "node",
            {
                "app:///utils/errors.js",
                "../../packages/api/src/response.ts",
                "app:///../foo/bar/index.js",
            },
            id="node_app_protocol_and_relative_paths",
        ),
        pytest.param(
            [
                {"filename": "sentry/tasks.py", "in_app": True},
                {"filename": "sentry/models/release.py", "in_app": True},
            ],
            "python",
            {
                "sentry/tasks.py",
                "sentry/models/release.py",
            },
            id="python_paths",
        ),
    ],
)
def test_get_frames_to_process(frames: list[Frame], platform: str, expected: set[str]) -> None:
    frames = get_frames_to_process(frames, platform)
    assert frames == expected


@pytest.mark.parametrize(
    "frames, expected",
    [
        ([], []),
        ([{"in_app": True}], []),
    ],
)
def test_find_stacktrace_empty(frames: list[Frame], expected: list[str]) -> None:
    frames = get_frames_to_process(frames)
    assert frames == expected
