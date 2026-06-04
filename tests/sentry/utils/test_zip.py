from sentry.utils.zip import is_unsafe_path


def test_is_unsafe_path() -> None:
    assert is_unsafe_path("/foo.txt")
    assert is_unsafe_path("../foo.txt")
    assert is_unsafe_path("aha/../foo.txt")
    assert not is_unsafe_path("foo.txt")
    assert not is_unsafe_path("foo/bar.txt")


def test_is_unsafe_path_backslash_traversal() -> None:
    assert is_unsafe_path("..\\foo.txt")
    assert is_unsafe_path("..\\..\\foo.txt")
    assert is_unsafe_path("aha\\..\\foo.txt")
    assert is_unsafe_path("aha\\..\\..\\foo.txt")


def test_is_unsafe_path_mixed_separators() -> None:
    assert is_unsafe_path("../..\\foo.txt")
    assert is_unsafe_path("..\\../foo.txt")
    assert is_unsafe_path("a/b\\..\\../foo.txt")


def test_is_unsafe_path_windows_absolute() -> None:
    assert is_unsafe_path("C:\\evil.exe")
    assert is_unsafe_path("C:/evil.exe")
    assert is_unsafe_path("D:\\Windows\\System32\\evil.dll")


def test_is_unsafe_path_backslash_absolute() -> None:
    assert is_unsafe_path("\\\\server\\share\\file.txt")
    assert is_unsafe_path("\\foo.txt")


def test_is_unsafe_path_safe_with_backslash_in_name() -> None:
    assert not is_unsafe_path("foo\\bar.txt")
    assert not is_unsafe_path("a\\b\\c.txt")
