from __future__ import absolute_import

from collections import (
    OrderedDict,
    defaultdict,
)
from exam import fixture
from six.moves import reduce

from datetime import timedelta
from django.utils import timezone

from sentry.digests import Record

from sentry.digests.notifications import (
    Notification,
    event_to_record,
    rewrite_record,
    group_records,
    sort_records,
    sort_group_contents,
    sort_rule_groups,
)
from sentry.models import Rule
from sentry.testutils import TestCase


class RewriteRecordTestCase(TestCase):
    @fixture
    def rule(self):
        return self.event.project.rule_set.all()[0]

    @fixture
    def record(self):
        return event_to_record(self.event, (self.rule, ))

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
        events = [self.create_event(group=self.group) for _ in range(3)]
        records = [
            Record(event.id, Notification(event, [self.rule]), event.datetime) for event in events
        ]
        assert reduce(group_records, records, defaultdict(lambda: defaultdict(list))) == {
            self.rule: {
                self.group: records,
            },
        }


class SortRecordsTestCase(TestCase):
    def test_success(self):
        Rule.objects.create(
            project=self.project,
            label='Send a notification for regressions',
            data={
                'match':
                'all',
                'conditions': [
                    {
                        'id': 'sentry.rules.conditions.regression_event.RegressionEventCondition'
                    },
                ],
                'actions': [
                    {
                        'id': 'sentry.rules.actions.notify_event.NotifyEventAction'
                    },
                ],
            }
        )

        rules = list(self.project.rule_set.all())
        groups = [self.create_group() for _ in range(3)]

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

        assert sort_rule_groups(sort_group_contents(grouped)) == OrderedDict(
            (
                (rules[1], OrderedDict(((groups[1], []), (groups[2], []), ))),
                (rules[0], OrderedDict(((groups[0], []), ))),
            )
        )


class SortWholeRecordsTestCase(TestCase):
    def setUp(self):
        self.group = self.create_group(
            first_seen=timezone.now() - timedelta(days=3),
            last_seen=timezone.now() - timedelta(hours=3),
            project=self.project,
            message='hello  world this is a group',
            logger='root',
        )
        self.group1 = self.create_group(
            project=self.project,
            first_seen=timezone.now() - timedelta(days=2),
            last_seen=timezone.now() - timedelta(hours=2),
            message='group 2',
            logger='root',
        )
        self.group2 = self.create_group(
            project=self.project,
            first_seen=timezone.now() - timedelta(days=1),
            last_seen=timezone.now() - timedelta(hours=1),
            message='group 3',
            logger='root',
        )
        self.event_single_user = self.create_event(
            group=self.group,
            message=self.group.message,
            datetime=self.group.last_seen,
            project=self.project,
        )
        self.event_all_users = self.create_event(
            group=self.group1,
            message=self.group1.message,
            datetime=self.group1.last_seen,
            project=self.project,
        )
        self.event_team = self.create_event(
            group=self.group2,
            message=self.group2.message,
            datetime=self.group2.last_seen,
            project=self.project,
        )

        self.rule = self.project.rule_set.all()[0]

    def test_sort_records(self):
        record1 = event_to_record(self.event_team, (self.rule,))
        record2 = event_to_record(self.event_all_users, (self.rule,))
        record3 = event_to_record(self.event_single_user, (self.rule,))

        records = sort_records((record2, record3, record1))

        assert len(records) == 3
        assert records[0] == record1
        assert records[1] == record2
        assert records[2] == record3
