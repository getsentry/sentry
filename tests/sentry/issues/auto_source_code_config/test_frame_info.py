from typing import Any

import pytest

from sentry.issues.auto_source_code_config.errors import (
    DoesNotFollowJavaPackageNamingConvention,
    MissingModuleOrAbsPath,
    NeedsExtension,
    UnsupportedFrameInfo,
)
from sentry.issues.auto_source_code_config.frame_info import FrameInfo

UNSUPPORTED_FRAME_FILENAMES = [
    "async https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
    "/gtm.js",  # Top source; starts with backslash
    "<anonymous>",
    "<frozen importlib._bootstrap>",
    "[native code]",
    "O$t",
    "async https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
    "README",  # top level file
    "ssl.py",
    # XXX: The following will need to be supported
    "initialization.dart",
    "backburner.js",
]

NO_EXTENSION_FRAME_FILENAMES = [
    "/foo/bar/baz",  # no extension
]


class TestFrameInfo:
    def test_frame_filename_repr(self) -> None:
        path = "getsentry/billing/tax/manager.py"
        assert FrameInfo({"filename": path}).__repr__() == f"FrameInfo: {path}"

    def test_raises_unsupported(self) -> None:
        for filepath in UNSUPPORTED_FRAME_FILENAMES:
            with pytest.raises(UnsupportedFrameInfo):
                FrameInfo({"filename": filepath})

    def test_raises_no_extension(self) -> None:
        for filepath in NO_EXTENSION_FRAME_FILENAMES:
            with pytest.raises(NeedsExtension):
                FrameInfo({"filename": filepath})

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
            FrameInfo(frame, "java")

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
        ],
    )
    def test_java_valid_frames(
        self, frame: dict[str, Any], expected_stack_root: str, expected_normalized_path: str
    ) -> None:
        frame_info = FrameInfo(frame, "java")
        assert frame_info.stack_root == expected_stack_root
        assert frame_info.normalized_path == expected_normalized_path

    @pytest.mark.parametrize(
        "frame_filename, prefix",
        [
            pytest.param(
                "app:///utils/something.py",
                "app:///utils",
            ),
            pytest.param(
                "./app/utils/something.py",
                "./app",
            ),
            pytest.param(
                "../../../../../../packages/something.py",
                "../../../../../../packages",
            ),
            pytest.param(
                "app:///../services/something.py",
                "app:///../services",
            ),
        ],
    )
    def test_straight_path_prefix(self, frame_filename: str, prefix: str) -> None:
        frame_info = FrameInfo({"filename": frame_filename})
        assert frame_info.stack_root == prefix
