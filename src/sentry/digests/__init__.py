from __future__ import absolute_import

from collections import namedtuple

from sentry.utils.dates import to_datetime


class Record(namedtuple('Record', 'key value timestamp')):
    @property
    def datetime(self):
        return to_datetime(self.timestamp)


ScheduleEntry = namedtuple('ScheduleEntry', 'key timestamp')
