from typing import Any

import pytest

from sentry.issues.auto_source_code_config.errors import (
    DoesNotFollowJavaPackageNamingConvention,
    MissingModuleOrAbsPath,
    NeedsExtension,
    UnsupportedFrameInfo,
)
from sentry.issues.auto_source_code_config.frame_info import create_frame_info

UNSUPPORTED_FRAME_FILENAMES = [
    # HTTP/HTTPS URLs
    "https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
    "http://example.com/script.js",
    "HTTP://EXAMPLE.COM/SCRIPT.JS",
    "async https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
    "webpack:///https://cdn.example.com/bundle.js",
    # Special frame types
    "<anonymous>",
    "<frozen importlib._bootstrap>",
    "[native code]",
]

# Files with "http" substring that should be ACCEPTED
LEGITIMATE_HTTP_FILENAMES = [
    "src/httpclient/request.py",
    "/usr/local/httpd/config.py",
    "lib/http_utils.js",
    "services/httpserver/main.go",
    "lib/https_client.rb",
    "network/http2/stream.go",
]

NO_EXTENSION_FRAME_FILENAMES = [
    "/foo/bar/baz",
    "README",
    "O$t",
]


class TestFrameInfo:
    def test_frame_filename_repr(self) -> None:
        path = "getsentry/billing/tax/manager.py"
        frame_info = create_frame_info({"filename": path})
        expected = f"FrameInfo: {path} stack_root: {frame_info.stack_root}"
        assert frame_info.__repr__() == expected

    @pytest.mark.parametrize("filepath", UNSUPPORTED_FRAME_FILENAMES)
    def test_raises_unsupported(self, filepath: str) -> None:
        with pytest.raises(UnsupportedFrameInfo):
            create_frame_info({"filename": filepath})

    @pytest.mark.parametrize("filepath", LEGITIMATE_HTTP_FILENAMES)
    def test_legitimate_http_filenames_accepted(self, filepath: str) -> None:
        # These files contain "http" but should NOT be rejected
        frame_info = create_frame_info({"filename": filepath})
        assert frame_info.raw_path == filepath

    def test_raises_no_extension(self) -> None:
        for filepath in NO_EXTENSION_FRAME_FILENAMES:
            with pytest.raises(NeedsExtension):
                create_frame_info({"filename": filepath})

    @pytest.mark.parametrize(
        "frame, expected_exception",
        [
            pytest.param({}, MissingModuleOrAbsPath, id="no_module"),
            pytest.param({"module": "foo"}, MissingModuleOrAbsPath, id="no_abs_path"),
            pytest.param(
                # Classes without declaring a package are placed in
                # the unnamed package which cannot be imported.
                # https://docs.oracle.com/javase/specs/jls/se8/html/jls-7.html#jls-7.4.2
                {"module": "NoPackageName", "abs_path": "OtherActivity.java"},
                DoesNotFollowJavaPackageNamingConvention,
                id="unnamed_package",
            ),
        ],
    )
    def test_java_raises_exception(
        self, frame: dict[str, Any], expected_exception: type[Exception]
    ) -> None:
        with pytest.raises(expected_exception):
            create_frame_info(frame, "java")

    @pytest.mark.parametrize(
        "frame, expected_stack_root, expected_normalized_path",
        [
            pytest.param(
                {"module": "foo.bar.Baz$handle$1", "abs_path": "baz.java"},
                "foo/bar/",
                "foo/bar/baz.java",
                id="dollar_symbol_in_module",
            ),
            pytest.param(
                {"module": "foo.bar.Baz", "abs_path": "baz.extra.java"},
                "foo/bar/",
                "foo/bar/baz.extra.java",
                id="two_dots_in_abs_path",
            ),
            pytest.param(
                {"module": "foo.bar.Baz", "abs_path": "no_extension"},
                "foo/bar/",
                "foo/bar/Baz",  # The path does not use the abs_path
                id="invalid_abs_path_no_extension",
            ),
            pytest.param(
                {"module": "foo.bar.Baz", "abs_path": "foo$bar"},
                "foo/bar/",
                "foo/bar/Baz",  # The path does not use the abs_path
                id="invalid_abs_path_dollar_sign",
            ),
            pytest.param(
                {"module": "foo.Baz", "abs_path": "foo"},
                "foo/",  # Single-depth stack root
                "foo/Baz",
                id="granularity_1",
            ),
        ],
    )
    def test_java_valid_frames(
        self, frame: dict[str, Any], expected_stack_root: str, expected_normalized_path: str
    ) -> None:
        frame_info = create_frame_info(frame, "java")
        assert frame_info.stack_root == expected_stack_root
        assert frame_info.normalized_path == expected_normalized_path

    @pytest.mark.parametrize(
        "frame_filename, stack_root, normalized_path",
        [
            pytest.param(
                "app:///utils/something.py",
                "app:///utils",
                "utils/something.py",
            ),
            pytest.param(
                "./app/utils/something.py",
                "./app",
                "app/utils/something.py",
            ),
            pytest.param(
                "../../../../../../packages/something.py",
                "../../../../../../packages",
                "packages/something.py",
            ),
            pytest.param(
                "app:///../services/something.py",
                "app:///../services",
                "services/something.py",
            ),
            pytest.param(
                "/it/handles/backslashes/baz.py",
                "/it/",
                "it/handles/backslashes/baz.py",
            ),
        ],
    )
    def test_straight_path_prefix(
        self, frame_filename: str, stack_root: str, normalized_path: str
    ) -> None:
        frame_info = create_frame_info({"filename": frame_filename})
        assert frame_info.normalized_path == normalized_path
        assert frame_info.stack_root == stack_root
