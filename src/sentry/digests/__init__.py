from __future__ import absolute_import

from collections import namedtuple


Record = namedtuple('Record', 'key value timestamp')

ScheduleEntry = namedtuple('ScheduleEntry', 'key timestamp')
