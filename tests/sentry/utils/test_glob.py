from typing import NamedTuple, Self

import pytest

from sentry.utils.glob import glob_match


class GlobInput(NamedTuple):
    value: str | None
    pat: str
    kwargs: dict[str, bool]

    @classmethod
    def make(cls, value: str | None, pat: str, **kwargs: bool) -> Self:
        return cls(value=value, pat=pat, kwargs=kwargs)

    def __call__(self):
        return glob_match(self.value, self.pat, **self.kwargs)


@pytest.mark.parametrize(
    "glob_input,expect",
    [
        [GlobInput.make("hello.py", "*.py"), True],
        [GlobInput.make("hello.py", "*.js"), False],
        [GlobInput.make(None, "*.js"), False],
        [GlobInput.make(None, "*"), True],
        [GlobInput.make("foo/hello.py", "*.py"), True],
        [GlobInput.make("foo/hello.py", "*.py", doublestar=True), False],
        [GlobInput.make("foo/hello.py", "**/*.py", doublestar=True), True],
        [GlobInput.make("foo/hello.PY", "**/*.py"), False],
        [GlobInput.make("foo/hello.PY", "**/*.py", doublestar=True), False],
        [GlobInput.make("foo/hello.PY", "**/*.py", ignorecase=True), True],
        [GlobInput.make("foo/hello.PY", "**/*.py", doublestar=True, ignorecase=True), True],
        [GlobInput.make("root\\foo\\hello.PY", "root/**/*.py", ignorecase=True), False],
        [
            GlobInput.make("root\\foo\\hello.PY", "root/**/*.py", doublestar=True, ignorecase=True),
            False,
        ],
        [
            GlobInput.make(
                "root\\foo\\hello.PY", "root/**/*.py", ignorecase=True, path_normalize=True
            ),
            True,
        ],
        [
            GlobInput.make(
                "root\\foo\\hello.PY",
                "root/**/*.py",
                doublestar=True,
                ignorecase=True,
                path_normalize=True,
            ),
            True,
        ],
        [GlobInput.make("foo:\nbar", "foo:*"), True],
        [GlobInput.make("foo:\nbar", "foo:*", allow_newline=False), False],
    ],
)
def test_glob_match(glob_input, expect):
    assert glob_input() == expect
