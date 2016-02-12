from __future__ import absolute_import

from collections import namedtuple

from sentry.utils.dates import to_datetime


class Record(namedtuple('Record', 'key value timestamp')):
    @property
    def datetime(self):
        return to_datetime(self.timestamp)


ScheduleEntry = namedtuple('ScheduleEntry', 'key timestamp')


OPTIONS = frozenset((
    'increment_delay',
    'maximum_delay',
    'minimum_delay',
))


def get_option_key(plugin, option):
    assert option in OPTIONS
    return 'digests:{}:{}'.format(plugin, option)
