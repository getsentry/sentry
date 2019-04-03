from __future__ import absolute_import

import pytest

from sentry.grouping.utils import get_grouping_family_for_platform


@pytest.mark.parametrize(
    'input,output',
    [
        ('native', 'native'),
        ('c', 'native'),
        ('swift', 'native'),
        ('cocoa', 'native'),
        ('objc', 'native'),
        ('javascript', 'javascript'),
        ('node', 'javascript'),
        ('elixir', 'other'),
        ('whatever', 'other'),
    ]
)
def test_get_grouping_family_for_platform(input, output):
    assert get_grouping_family_for_platform(input) == output
