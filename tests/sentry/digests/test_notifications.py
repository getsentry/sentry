from __future__ import absolute_import

from collections import OrderedDict

from exam import fixture

from sentry.digests import Record
from sentry.digests.notifications import (
    Notification,
    event_to_record,
    rewrite_record,
    group_records,
    sort_groups,
)
from sentry.testutils import TestCase


class RewriteRecordTestCase(TestCase):
    @fixture
    def rule(self):
        return self.event.project.rule_set.all()[0]

    @fixture
    def record(self):
        return event_to_record(self.event, (self.rule,))

    def test_success(self):
        assert rewrite_record(
            self.record,
            project=self.event.project,
            groups={
                self.event.group.id: self.event.group,
            },
            rules={
                self.rule.id: self.rule,
            },
        ) == Record(
            self.record.key,
            Notification(
                self.event,
                [self.rule],
            ),
            self.record.timestamp,
        )

    def test_without_group(self):
        # If the record can't be associated with a group, it should be returned as None.
        assert rewrite_record(
            self.record,
            project=self.event.project,
            groups={},
            rules={
                self.rule.id: self.rule,
            },
        ) is None

    def test_filters_invalid_rules(self):
        # If the record can't be associated with a group, it should be returned as None.
        assert rewrite_record(
            self.record,
            project=self.event.project,
            groups={
                self.event.group.id: self.event.group,
            },
            rules={},
        ) == Record(
            self.record.key,
            Notification(self.event, []),
            self.record.timestamp,
        )


class GroupRecordsTestCase(TestCase):
    @fixture
    def rule(self):
        return self.project.rule_set.all()[0]

    def test_success(self):
        events = [self.create_event(group=self.group) for _ in xrange(3)]
        records = [Record(event.id, Notification(event, [self.rule]), event.datetime) for event in events]
        assert group_records(records) == {
            self.rule: {
                self.group: records,
            },
        }


class SortRecordsTestCase(TestCase):
    def test_success(self):
        rules = list(self.project.rule_set.all())
        groups = [self.create_group() for _ in xrange(3)]

        groups[0].event_count = 10
        groups[0].user_count = 4

        groups[1].event_count = 5
        groups[1].user_count = 2

        groups[2].event_count = 5
        groups[2].user_count = 1

        grouped = {
            rules[0]: {
                groups[0]: [],
            },
            rules[1]: {
                groups[1]: [],
                groups[2]: [],
            },
        }

        assert sort_groups(grouped) == OrderedDict((
            (rules[1], OrderedDict((
                (groups[1], []),
                (groups[2], []),
            ))),
            (rules[0], OrderedDict((
                (groups[0], []),
            ))),
        ))
