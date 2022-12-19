from collections import defaultdict
from functools import cached_property, reduce

from sentry.digests import Record
from sentry.digests.notifications import (
    Notification,
    event_to_record,
    group_records,
    rewrite_record,
    sort_group_contents,
    sort_rule_groups,
    split_key,
    unsplit_key,
)
from sentry.models import Rule
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


class RewriteRecordTestCase(TestCase):
    @cached_property
    def rule(self):
        return self.event.project.rule_set.all()[0]

    @cached_property
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


@region_silo_test
class GroupRecordsTestCase(TestCase):
    @cached_property
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

        ret = sort_rule_groups(sort_group_contents(grouped))

        # ensure top-level keys are sorted
        assert tuple(ret) == (rules[1], rules[0])
        # ensure second-level keys are sorted
        assert tuple(ret[rules[1]]) == (groups[1], groups[2])

        assert ret == {
            rules[1]: {groups[1]: [], groups[2]: []},
            rules[0]: {groups[0]: []},
        }


class SplitKeyTestCase(TestCase):
    def test_old_style_key(self):
        assert split_key(f"mail:p:{self.project.id}") == (
            self.project,
            ActionTargetType.ISSUE_OWNERS,
            None,
            None,
        )

    def test_new_style_key_no_identifier(self):
        assert split_key(f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:") == (
            self.project,
            ActionTargetType.ISSUE_OWNERS,
            None,
            None,
        )

    def test_new_style_key_identifier(self):
        identifier = "123"
        assert split_key(
            f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}"
        ) == (self.project, ActionTargetType.ISSUE_OWNERS, identifier, None)

    def test_fallthrough_choice(self):
        identifier = "123"
        fallthrough_choice = FallthroughChoiceType.ALL_MEMBERS
        assert split_key(
            f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}:{fallthrough_choice.value}"
        ) == (self.project, ActionTargetType.ISSUE_OWNERS, identifier, fallthrough_choice)

    def test_no_fallthrough_choice(self):
        identifier = "123"
        assert split_key(
            f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}:"
        ) == (self.project, ActionTargetType.ISSUE_OWNERS, identifier, None)


class UnsplitKeyTestCase(TestCase):
    def test_no_identifier(self):
        assert (
            unsplit_key(self.project, ActionTargetType.ISSUE_OWNERS, None, None)
            == f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}::"
        )

    def test_no_fallthrough(self):
        identifier = "123"
        assert (
            unsplit_key(self.project, ActionTargetType.ISSUE_OWNERS, identifier, None)
            == f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}:"
        )

    def test_identifier(self):
        identifier = "123"
        fallthrough_choice = FallthroughChoiceType.ALL_MEMBERS
        assert (
            unsplit_key(self.project, ActionTargetType.ISSUE_OWNERS, identifier, fallthrough_choice)
            == f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}:{fallthrough_choice.value}"
        )
