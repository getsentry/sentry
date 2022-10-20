import pytest

from tools.pin_github_action import ACTION_VERSION_RE


@pytest.mark.parametrize(
    ("s", "expected"),
    (
        ("uses: actions/cache@v1\n", ("actions/cache", "v1")),
        ("uses: actions/cache@v1  # after\n", ("actions/cache", "v1")),
        ("uses: actions/cache@v1# after\n", ("actions/cache", "v1")),
        ("uses: actions/cache@v1.0.0\n", ("actions/cache", "v1.0.0")),
        ("uses: actions/cache@v1.0.0 # after\n", ("actions/cache", "v1.0.0")),
    ),
)
def test_matches(s, expected):
    match = ACTION_VERSION_RE.search(s)
    assert match
    assert (match[1], match[2]) == expected
