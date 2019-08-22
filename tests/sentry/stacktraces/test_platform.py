from __future__ import absolute_import

import pytest

from sentry.stacktraces.platform import get_behavior_family_for_platform


@pytest.mark.parametrize(
    "input,output",
    [
        ("native", "native"),
        ("c", "native"),
        ("swift", "native"),
        ("cocoa", "native"),
        ("objc", "native"),
        ("javascript", "javascript"),
        ("node", "javascript"),
        ("elixir", "other"),
        ("whatever", "other"),
    ],
)
def test_get_grouping_family_for_platform(input, output):
    assert get_behavior_family_for_platform(input) == output
