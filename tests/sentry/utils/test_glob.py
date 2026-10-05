from typing import NamedTuple, Self

import pytest

from sentry.utils.glob import glob_match, glob_star_match


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
def test_glob_match(glob_input: GlobInput, expect: bool) -> None:
    assert glob_input() == expect


@pytest.mark.parametrize(
    ("pattern", "value", "expected"),
    [
        ("sentry", "sentry", True),
        ("sentry", "getsentry", False),
        ("jayonb*", "jayonb73", True),
        ("jayonb*", "jayonb", True),
        ("jayonb*", "dangoldonb1", False),
        ("*@sentry.io", "user@sentry.io", True),
        ("*@sentry.io", "user@example.com", False),
        ("jay.goss+onboarding*@sentry.io", "jay.goss+onboarding70@sentry.io", True),
        ("jay.goss+onboarding*@sentry.io", "jay.goss+onboarding@sentry.io", True),
        ("jay.goss+onboarding*@sentry.io", "jay.goss+onboarding70@example.com", False),
        ("a*b*c", "abc", True),
        ("a*b*c", "aXXbYYc", True),
        ("a*b*c", "aXXc", False),
        ("a**b", "ab", True),
        ("*", "anything", True),
        ("*", "", True),
        ("JAYONB*", "jayonb73", True),
        ("jayonb*", "JAYONB73", True),
        # The prefix and suffix anchors may not overlap.
        ("a*a", "a", False),
        ("a*a", "aa", True),
        ("ab*ab", "ab", False),
        ("ab*ab", "abab", True),
        # Only '*' is a wildcard.
        ("a?c", "abc", False),
        ("a?c", "a?c", True),
        ("[ab]", "a", False),
    ],
)
def test_glob_star_match(pattern: str, value: str, expected: bool) -> None:
    assert glob_star_match(pattern, value) is expected
