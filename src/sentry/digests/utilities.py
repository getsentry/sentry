from __future__ import absolute_import

import six

from collections import Counter


# TODO(tkaemming): This should probably just be part of `build_digest`.
def get_digest_metadata(digest):
    start = None
    end = None

    counts = Counter()
    for rule, groups in six.iteritems(digest):
        counts.update(groups.keys())

        for group, records in six.iteritems(groups):
            for record in records:
                if start is None or record.datetime < start:
                    start = record.datetime

                if end is None or record.datetime > end:
                    end = record.datetime

    return start, end, counts


def get_events_from_digest(digest):
    """
    Returns events with their corresponding rules.
    ** Uses group.get_latest_event **
    """
    events = []
    for groups in six.itervalues(digest):
        for group in groups:
            rules = groups[group][0].value.rules
            events.append((group.get_latest_event(), rules))
    return events
