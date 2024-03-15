from sentry.utils.zip import is_unsafe_path


def test_is_unsafe_path():
    assert is_unsafe_path("/foo.txt")
    assert is_unsafe_path("../foo.txt")
    assert is_unsafe_path("aha/../foo.txt")
    assert not is_unsafe_path("foo.txt")
    assert not is_unsafe_path("foo/bar.txt")
