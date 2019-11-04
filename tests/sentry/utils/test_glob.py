from __future__ import absolute_import

import pytest

from sentry.utils.glob import glob_match


class GlobInput(object):
    def __init__(self, value, pat, doublestar=False, ignorecase=False, path_normalize=False):
        self.value = value
        self.pat = pat
        self.doublestar = doublestar
        self.ignorecase = ignorecase
        self.path_normalize = path_normalize

    def __call__(self):
        return glob_match(**self.__dict__)


@pytest.mark.parametrize(
    "glob_input,expect",
    [
        [GlobInput("hello.py", "*.py"), True],
        [GlobInput("hello.py", "*.js"), False],
        [GlobInput("foo/hello.py", "*.py"), True],
        [GlobInput("foo/hello.py", "*.py", doublestar=True), False],
        [GlobInput("foo/hello.py", "**/*.py", doublestar=True), True],
        [GlobInput("foo/hello.PY", "**/*.py"), False],
        [GlobInput("foo/hello.PY", "**/*.py", doublestar=True), False],
        [GlobInput("foo/hello.PY", "**/*.py", ignorecase=True), True],
        [GlobInput("foo/hello.PY", "**/*.py", doublestar=True, ignorecase=True), True],
        [GlobInput("root\\foo\\hello.PY", "root/**/*.py", ignorecase=True), False],
        [GlobInput("root\\foo\\hello.PY", "root/**/*.py", doublestar=True, ignorecase=True), False],
        [
            GlobInput("root\\foo\\hello.PY", "root/**/*.py", ignorecase=True, path_normalize=True),
            True,
        ],
        [
            GlobInput(
                "root\\foo\\hello.PY",
                "root/**/*.py",
                doublestar=True,
                ignorecase=True,
                path_normalize=True,
            ),
            True,
        ],
    ],
)
def test_glob_match(glob_input, expect):
    assert glob_input() == expect
