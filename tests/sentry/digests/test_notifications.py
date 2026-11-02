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
from sentry.digests.types import (
    NotificationWithRuleObjects,
    Record,
    RecordWithRuleObjects,
)
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType, NotificationOrigin
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import Workflow

pytestmark = [requires_snuba]


def as_group_event(event: Event) -> GroupEvent:
    return event.for_group(event.groups[0])


class BindRecordsTestCase(TestCase):
    notification_uuid = str(uuid.uuid4())
    workflow_id = 123

    @cached_property
    def project(self) -> Project:
        return self.create_project(fire_project_created=True)

    @cached_property
    def record(self) -> Record:
        return event_to_record(as_group_event(self.event), (self.origin,), self.notification_uuid)

    @cached_property
    def origin(self) -> NotificationOrigin:
        return NotificationOrigin(
            label="Workflow",
            environment_id=None,
            workflow_id=self.workflow_id,
            legacy_rule_id=None,
        )

    @property
    def group_mapping(self) -> dict[int, Group]:
        return {self.event.group.id: self.event.group}

    @property
    def rule_mapping(self) -> dict[int, NotificationOrigin]:
        return {self.workflow_id: self.origin}

    def test_success(self) -> None:
        (record,) = _bind_records([self.record], self.group_mapping, self.rule_mapping)
        assert record == self.record.with_rules([self.origin])

    def test_record_uses_workflow_ids(self) -> None:
        assert self.record.value.rules == [self.workflow_id]

    def test_without_group(self) -> None:
        # If the record can't be associated with a group, it should be dropped
        assert not _bind_records([self.record], {}, self.rule_mapping)

    def test_filters_invalid_rules(self) -> None:
        # If the record can't be associated with a rule, the rule should be dropped
        (record,) = _bind_records([self.record], self.group_mapping, {})
        assert record == self.record.with_rules([])


class GroupRecordsTestCase(TestCase):
    notification_uuid = str(uuid.uuid4())

    @cached_property
    def project(self) -> Project:
        return self.create_project(fire_project_created=True)

    @cached_property
    def workflow(self) -> Workflow:
        return self.create_workflow(organization=self.project.organization)

    @cached_property
    def origin(self) -> NotificationOrigin:
        return NotificationOrigin(
            label=self.workflow.name,
            environment_id=self.workflow.environment_id,
            workflow_id=self.workflow.id,
            legacy_rule_id=None,
        )

    def test_success(self) -> None:
        events = [
            self.store_event(data={"fingerprint": ["group-1"]}, project_id=self.project.id)
            for i in range(3)
        ]
        group = events[0].group
        assert group is not None
        records = [
            RecordWithRuleObjects(
                event.event_id,
                NotificationWithRuleObjects(event, [self.origin], self.notification_uuid),
                event.datetime.timestamp(),
            )
            for event in events
        ]
        ret = _group_records(records, {group.id: group}, {self.workflow.id: self.origin})
        assert ret == {self.origin: {group: records}}

    def test_equivalent_origins_share_a_digest_group(self) -> None:
        event = self.store_event(data={"fingerprint": ["group-1"]}, project_id=self.project.id)
        group = event.group
        assert group is not None
        equivalent_origin = NotificationOrigin(
            label="Renamed alert",
            environment_id=None,
            workflow_id=self.origin.workflow_id,
            legacy_rule_id=self.origin.legacy_rule_id,
        )
        records = [
            RecordWithRuleObjects(
                event.event_id,
                NotificationWithRuleObjects(event, [origin], self.notification_uuid),
                event.datetime.timestamp(),
            )
            for origin in (self.origin, equivalent_origin)
        ]

        digest = _group_records(records, {group.id: group}, {self.workflow.id: self.origin})

        assert list(digest) == [self.origin]
        assert digest[self.origin][group] == records


class SortDigestTestCase(TestCase):
    @cached_property
    def project(self) -> Project:
        return self.create_project(fire_project_created=True)

    def test_success(self) -> None:
        first_workflow = self.create_workflow(
            organization=self.project.organization,
            name="Send a notification for new issues",
        )
        second_workflow = self.create_workflow(
            organization=self.project.organization,
            name="Send a notification for regressions",
        )
        origins = [
            NotificationOrigin(
                label=workflow.name,
                environment_id=workflow.environment_id,
                workflow_id=workflow.id,
                legacy_rule_id=None,
            )
            for workflow in (first_workflow, second_workflow)
        ]
        groups = [self.create_group() for _ in range(3)]

        event_counts = {groups[0].id: 10, groups[1].id: 5, groups[2].id: 5}
        user_counts = {groups[0].id: 4, groups[1].id: 2, groups[2].id: 1}

        grouped: Digest = {
            origins[0]: {groups[0]: []},
            origins[1]: {groups[1]: [], groups[2]: []},
        }

        ret = _sort_digest(grouped, event_counts, user_counts)

        # ensure top-level keys are sorted
        assert tuple(ret) == (origins[1], origins[0])
        # ensure second-level keys are sorted
        assert tuple(ret[origins[1]]) == (groups[1], groups[2])

        assert ret == {
            origins[1]: {groups[1]: [], groups[2]: []},
            origins[0]: {groups[0]: []},
        }


class SplitKeyTestCase(TestCase):
    def test_old_style_key(self) -> None:
        assert split_key(f"mail:p:{self.project.id}") == (
            self.project,
            ActionTargetType.ISSUE_OWNERS,
            None,
            None,
        )

    def test_new_style_key_no_identifier(self) -> None:
        assert split_key(f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:") == (
            self.project,
            ActionTargetType.ISSUE_OWNERS,
            None,
            None,
        )

    def test_new_style_key_identifier(self) -> None:
        identifier = 123
        assert split_key(
            f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}"
        ) == (self.project, ActionTargetType.ISSUE_OWNERS, identifier, None)

    def test_fallthrough_choice(self) -> None:
        identifier = 123
        fallthrough_choice = FallthroughChoiceType.ALL_MEMBERS
        assert split_key(
            f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}:{fallthrough_choice.value}"
        ) == (self.project, ActionTargetType.ISSUE_OWNERS, identifier, fallthrough_choice)

    def test_no_fallthrough_choice(self) -> None:
        identifier = 123
        assert split_key(
            f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}:"
        ) == (self.project, ActionTargetType.ISSUE_OWNERS, identifier, None)

    def test_handles_none_identifier_gracefully(self) -> None:
        assert split_key(
            f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:None:"
        ) == (self.project, ActionTargetType.ISSUE_OWNERS, "None", None)


class UnsplitKeyTestCase(TestCase):
    def test_no_identifier(self) -> None:
        assert (
            unsplit_key(self.project, ActionTargetType.ISSUE_OWNERS, None, None)
            == f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}::"
        )

    def test_no_fallthrough(self) -> None:
        identifier = 123
        assert (
            unsplit_key(self.project, ActionTargetType.ISSUE_OWNERS, identifier, None)
            == f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}:"
        )

    def test_identifier(self) -> None:
        identifier = 123
        fallthrough_choice = FallthroughChoiceType.ALL_MEMBERS
        assert (
            unsplit_key(self.project, ActionTargetType.ISSUE_OWNERS, identifier, fallthrough_choice)
            == f"mail:p:{self.project.id}:{ActionTargetType.ISSUE_OWNERS.value}:{identifier}:{fallthrough_choice.value}"
        )
