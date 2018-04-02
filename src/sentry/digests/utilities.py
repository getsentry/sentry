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


def get_digest_event_rules(digest):
    """
    Returns a dictionary consisting of {event:rules}
    from a digest object.
    """
    event_rules = {}
    for groups in six.itervalues(digest):
        for group in groups:
            value = groups[group][0].value
            event_rules[value.event] = value.rules
    return event_rules
