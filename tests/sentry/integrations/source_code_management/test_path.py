import pytest

from sentry.integrations.source_code_management.path import (
    is_absolute_scm_path,
    normalize_scm_path,
)


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        pytest.param("", "", id="empty"),
        pytest.param("src/file.py", "src/file.py", id="relative"),
        pytest.param("src/./file.py", "src/file.py", id="dot-segment"),
        pytest.param("src/lib/../file.py", "src/file.py", id="safe-parent-segment"),
        pytest.param("src\\file.py", "src/file.py", id="windows-separator"),
        pytest.param("src/%3Fname.py", "src/%3Fname.py", id="encoded-question-mark"),
        pytest.param("src/%23name.py", "src/%23name.py", id="encoded-fragment"),
        pytest.param(
            "src/../lib/my%20file.py",
            "lib/my%20file.py",
            id="safe-parent-with-encoded-space",
        ),
        # This helper canonicalizes paths but does not enforce repository
        # containment. The mapping layer rejects upward-relative results.
        pytest.param("../file.py", "../file.py", id="upward-relative-for-caller-validation"),
        pytest.param(
            "src/../../file.py",
            "../file.py",
            id="normalized-upward-relative-for-caller-validation",
        ),
        pytest.param("C:/src/file.py", "C:/src/file.py", id="windows-absolute"),
    ],
)
def test_normalize_scm_path(path: str, expected: str) -> None:
    assert normalize_scm_path(path) == expected


@pytest.mark.parametrize(
    "path",
    [
        pytest.param("src/file.py\x00.txt", id="null-byte"),
        pytest.param("src/file.py%00.txt", id="encoded-null-byte"),
        pytest.param("src/%2e%2e/file.py", id="encoded-parent-segment"),
        pytest.param("src/%252e%252e/file.py", id="double-encoded-parent-segment"),
        pytest.param("src/%25252e%25252e/file.py", id="triple-encoded-parent-segment"),
        pytest.param("C:/../file.py", id="windows-drive-root-escape"),
        pytest.param("C:/src/../../file.py", id="nested-windows-drive-root-escape"),
    ],
)
def test_normalize_scm_path_rejects_unsafe_paths(path: str) -> None:
    assert normalize_scm_path(path) is None


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        pytest.param("/src/file.py", True, id="posix-absolute"),
        pytest.param("C:/src/file.py", True, id="windows-absolute"),
        pytest.param("src/file.py", False, id="relative"),
    ],
)
def test_is_absolute_scm_path(path: str, expected: bool) -> None:
    assert is_absolute_scm_path(path) is expected
