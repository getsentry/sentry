from __future__ import absolute_import

import re
from datetime import timedelta


def parse_stats_period(period):
    """
    Convert a value such as 1h into a
    proper timedelta.
    """
    m = re.match('^(\d+)([hdms]?)$', period)
    if not m:
        return None
    value, unit = m.groups()
    value = int(value)
    if not unit:
        unit = 's'
    return timedelta(**{
        {'h': 'hours', 'd': 'days', 'm': 'minutes', 's': 'seconds'}[unit]: value,
    })
