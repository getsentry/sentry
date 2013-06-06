from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.utils.safe import trim

a_very_long_string = 'a' * 512


class TrimTest(TestCase):
    def test_simple_string(self):
        assert trim(a_very_long_string) == a_very_long_string[:253] + '...'

    def test_list_of_strings(self):
        assert trim([a_very_long_string, a_very_long_string]) == [
            a_very_long_string[:251] + '...',
        ]
