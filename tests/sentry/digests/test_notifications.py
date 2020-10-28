from __future__ import absolute_import

from collections import OrderedDict, defaultdict
from exam import fixture
from six.moves import reduce

from sentry.digests import Record
from sentry.digests.notifications import (
    Notification,
    event_to_record,
    rewrite_record,
    group_records,
    sort_group_contents,
    sort_rule_groups,
    split_key,
    unsplit_key,
)
from sentry.mail.adapter import ActionTargetType
from sentry.models import Rule
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
            groups={self.event.group.id: self.event.group},
            rules={self.rule.id: self.rule},
        ) == Record(
            self.record.key,
            Notification(self.record.value.event, [self.rule]),
            self.record.timestamp,
        )

    def test_without_group(self):
        # If the record can't be associated with a group, it should be returned as None.
        assert (
            rewrite_record(
                self.record, project=self.event.project, groups={}, rules={self.rule.id: self.rule}
            )
            is None
        )

    def test_filters_invalid_rules(self):
        assert rewrite_record(
            self.record,
            project=self.event.project,
            groups={self.event.group.id: self.event.group},
            rules={},
        ) == Record(
            self.record.key, Notification(self.record.value.event, []), self.record.timestamp
        )


class GroupRecordsTestCase(TestCase):
    @fixture
    def rule(self):
        return self.project.rule_set.all()[0]

    def test_success(self):
        events = [
            self.store_event(data={"fingerprint": ["group-1"]}, project_id=self.project.id)
            for i in range(3)
        ]
        group = events[0].group
        records = [
            Record(event.event_id, Notification(event, [self.rule]), event.datetime)
            for event in events
        ]
        assert reduce(group_records, records, defaultdict(lambda: defaultdict(list))) == {
            self.rule: {group: records}
        }


class SortRecordsTestCase(TestCase):
    def test_success(self):
        Rule.objects.create(
            project=self.project,
            label="Send a notification for regressions",
            data={
                "match": "all",
                "conditions": [
                    {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"}
                ],
                "actions": [{"id": "sentry.rules.actions.notify_event.NotifyEventAction"}],
            },
        )

        rules = list(self.project.rule_set.all())
        groups = [self.create_group() for _ in range(3)]

        groups[0].event_count = 10
        groups[0].user_count = 4

        groups[1].event_count = 5
        groups[1].user_count = 2

        groups[2].event_count = 5
        groups[2].user_count = 1

        grouped = {rules[0]: {groups[0]: []}, rules[1]: {groups[1]: [], groups[2]: []}}

        assert sort_rule_groups(sort_group_contents(grouped)) == OrderedDict(
            (
                (rules[1], OrderedDict(((groups[1], []), (groups[2], [])))),
                (rules[0], OrderedDict(((groups[0], []),))),
            )
        )


class SplitKeyTestCase(TestCase):
    def test_old_style_key(self):
        assert split_key("mail:p:{}".format(self.project.id)) == (
            self.project,
            ActionTargetType.ISSUE_OWNERS,
            None,
        )

    def test_new_style_key_no_identifier(self):
        assert split_key(
            "mail:p:{}:{}:".format(self.project.id, ActionTargetType.ISSUE_OWNERS.value)
        ) == (self.project, ActionTargetType.ISSUE_OWNERS, None)

    def test_new_style_key_identifier(self):
        identifier = "123"
        assert split_key(
            "mail:p:{}:{}:{}".format(
                self.project.id, ActionTargetType.ISSUE_OWNERS.value, identifier
            )
        ) == (self.project, ActionTargetType.ISSUE_OWNERS, identifier)


class UnsplitKeyTestCase(TestCase):
    def test_no_identifier(self):
        assert unsplit_key(
            self.project, ActionTargetType.ISSUE_OWNERS, None
        ) == "mail:p:{}:{}:".format(self.project.id, ActionTargetType.ISSUE_OWNERS.value)

    def test_identifier(self):
        identifier = "123"
        assert unsplit_key(
            self.project, ActionTargetType.ISSUE_OWNERS, identifier
        ) == "mail:p:{}:{}:{}".format(
            self.project.id, ActionTargetType.ISSUE_OWNERS.value, identifier
        )
