from sentry.utils.zip import find_common_prefix, is_unsafe_path


def test_is_unsafe_path():
    assert is_unsafe_path("/foo.txt")
    assert is_unsafe_path("../foo.txt")
    assert is_unsafe_path("aha/../foo.txt")
    assert not is_unsafe_path("foo.txt")
    assert not is_unsafe_path("foo/bar.txt")


def test_find_common_prefix():
    assert find_common_prefix(["foo/bar", ".crap", "foo/bar/baz"]) == "foo/"
    assert find_common_prefix(["foo/bar", ".crap", "x/foo/bar/baz"]) == ""
    assert find_common_prefix(["foo/bar", "foo"]) == "foo/"
    assert find_common_prefix(["foo/bar", "bar"]) == ""
