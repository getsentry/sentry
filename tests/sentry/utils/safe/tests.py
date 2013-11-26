from __future__ import absolute_import

import itertools

from sentry.testutils import TestCase
from sentry.utils.safe import trim, trim_dict, trim_frames

a_very_long_string = 'a' * 1024


class TrimTest(TestCase):
    def test_simple_string(self):
        assert trim(a_very_long_string) == a_very_long_string[:509] + '...'

    def test_list_of_strings(self):
        assert trim([a_very_long_string, a_very_long_string]) == [
            a_very_long_string[:507] + '...',
        ]


class TrimDictTest(TestCase):
    def test_large_dict(self):
        value = dict((k, k) for k in xrange(500))
        trim_dict(value)
        assert len(value) == 50


class TrimStacktraceTest(TestCase):
    def test_under_max(self):
        value = {'frames': [{'filename': 'foo'}]}
        trim_frames(value)
        assert len(value['frames']) == 1
        assert value.get('frames_omitted') is None

    def test_over_max(self):
        values = []
        for n in xrange(5):
            values.append({'filename': 'frame %d' % n})
        value = {'frames': values}
        trim_frames(value, max_frames=4)

        assert len(value['frames']) == 4

        for value, num in itertools.izip(values[:2], xrange(2)):
            assert value['filename'] == 'frame %d' % num

        for value, num in itertools.izip(values[2:], xrange(3, 5)):
            assert value['filename'] == 'frame %d' % num
