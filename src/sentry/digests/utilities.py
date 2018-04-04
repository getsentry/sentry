from __future__ import absolute_import

import six

from collections import Counter, OrderedDict


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


def get_personalized_digests(project, digest, user_ids):
    pass


def build_custom_digest(original_digest, user_id, events_by_users):
    user_digest = OrderedDict()
    for rule, rule_groups in six.iteritems(original_digest):
        user_rule_groups = OrderedDict()
        for group, group_records in six.iteritems(rule_groups):
            user_group_records = [
                record for record in group_records
                if user_id in events_by_users[record.value.event]
            ]
            if user_group_records:
                user_rule_groups[group] = user_group_records

        if user_rule_groups:
            user_digest[rule] = user_rule_groups
    return user_digest
