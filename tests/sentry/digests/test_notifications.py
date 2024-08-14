from __future__ import annotations

import uuid
from functools import cached_property

from sentry.digests.notifications import (
    Digest,
    _bind_records,
    _group_records,
    _sort_digest,
    event_to_record,
    split_key,
    unsplit_key,
)
from sentry.digests.types import NotificationWithRuleObjects, Record, RecordWithRuleObjects
from sentry.models.group import Group
from sentry.models.rule import Rule
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class BindRecordsTestCase(TestCase):
    notification_uuid = str(uuid.uuid4())

    @cached_property
    def rule(self) -> Rule:
        return self.event.project.rule_set.all()[0]

    @cached_property
    def record(self) -> Record:
        return event_to_record(self.event, (self.rule,), self.notification_uuid)

    @property
    def group_mapping(self) -> dict[int, Group]:
        return {self.event.group.id: self.event.group}

    @property
    def rule_mapping(self) -> dict[int, Rule]:
        return {self.rule.id: self.rule}

    def test_success(self):
        (record,) = _bind_records([self.record], self.group_mapping, self.rule_mapping)
        assert record == self.record.with_rules([self.rule])

    def test_without_group(self):
        # If the record can't be associated with a group, it should be dropped
        assert not _bind_records([self.record], {}, self.rule_mapping)

    def test_filters_invalid_rules(self):
        # If the record can't be associated with a rule, the rule should be dropped
        (record,) = _bind_records([self.record], self.group_mapping, {})
        assert record == self.record.with_rules([])


class GroupRecordsTestCase(TestCase):
    notification_uuid = str(uuid.uuid4())

    @cached_property
    def rule(self):
        return self.project.rule_set.all()[0]

    def test_success(self):
        events = [
            self.store_event(data={"fingerprint": ["group-1"]}, project_id=self.project.id)
            for i in range(3)
        ]
        group = events[0].group
        assert group is not None
        records = [
            RecordWithRuleObjects(
                event.event_id,
                NotificationWithRuleObjects(event, [self.rule], self.notification_uuid),
                event.datetime.timestamp(),
            )
            for event in events
        ]
        ret = _group_records(records, {group.id: group}, {self.rule.id: self.rule})
        assert ret == {self.rule: {group: records}}


class SortDigestTestCase(TestCase):
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

        event_counts = {groups[0].id: 10, groups[1].id: 5, groups[2].id: 5}
        user_counts = {groups[0].id: 4, groups[1].id: 2, groups[2].id: 1}

        grouped: Digest = {rules[0]: {groups[0]: []}, rules[1]: {groups[1]: [], groups[2]: []}}

        ret = _sort_digest(grouped, event_counts, user_counts)

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
