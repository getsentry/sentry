from unittest.mock import patch

import pytest
from django.db import IntegrityError, router, transaction

from sentry.inbox.issue import (
    ISSUE,
    IssueAssignedData,
    IssueMentionedData,
    IssuePRReadyForReviewData,
)
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import InboxEventData
from sentry.issues.comments import create_comment, update_comment
from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.groupowner import GroupOwnerType
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxActorType, InboxItemEvent
from sentry.notifications.types import NotificationSettingEnum
from sentry.seer.entrypoints.operator import record_seer_activity
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType


class IssueItemTypeTest(TestCase):
    def test_identity(self) -> None:
        group = self.create_group(project=self.project)

        assert inbox_item_type_registry.get("issue") is ISSUE
        assert ISSUE.get_subject_id(group) == str(group.id)
        assert ISSUE.get_organization_id(group) == self.organization.id

    def test_titles(self) -> None:
        first = self.create_group(project=self.project, data={"title": "First issue"})
        second = self.create_group(project=self.project, data={"title": "Second issue"})
        other = self.create_group(
            project=self.create_project(organization=self.create_organization()),
            data={"title": "Other organization"},
        )
        deleted = self.create_group(project=self.project)
        deleted_id = str(deleted.id)
        deleted.delete()

        with self.assertNumQueries(1):
            titles = ISSUE.get_titles(
                organization=self.organization,
                subject_ids=[str(first.id), str(second.id), str(other.id), deleted_id, "invalid"],
            )

        assert titles == {str(first.id): "First issue", str(second.id): "Second issue"}

    def test_url(self) -> None:
        organization = self.organization
        expected = organization.absolute_url(f"/organizations/{organization.slug}/issues/123/")

        with self.assertNumQueries(0):
            assert ISSUE.get_url(organization=organization, subject_id="123") == expected


@pytest.mark.parametrize(
    "event_type, data_class",
    [
        ("issue.assigned", IssueAssignedData),
        ("issue.user_mentioned", IssueMentionedData),
        ("issue.team_mentioned", IssueMentionedData),
        ("issue.pr_ready_for_review", IssuePRReadyForReviewData),
    ],
)
def test_event_types(event_type: str, data_class: type[InboxEventData]) -> None:
    event = inbox_item_event_type_registry.get(event_type)

    assert event.item_type is ISSUE
    assert event.data_class is data_class


@with_feature(
    {"organizations:universal-inbox-recording": True, "organizations:universal-inbox": False}
)
class IssueProducerRecordingTest(TestCase):
    def test_assignment_ignores_delivery_preferences_and_unchanged_assignments(self) -> None:
        assignee = self.create_user()
        self.create_member(organization=self.organization, user=assignee, teams=[self.team])
        for provider in ("email", "slack"):
            self.create_notification_settings_provider(
                user_id=assignee.id,
                scope_type="user",
                scope_identifier=assignee.id,
                provider=provider,
                type=NotificationSettingEnum.WORKFLOW.value,
                value="never",
            )

        GroupAssignee.objects.assign(self.group, assignee, acting_user=self.user)
        GroupAssignee.objects.assign(self.group, assignee, acting_user=self.user)

        event = InboxItemEvent.objects.get()
        assert event.type == "issue.assigned"
        assert event.inbox_item.user_id == assignee.id
        assert event.inbox_item.organization_id == self.organization.id
        assert event.inbox_item.subject_id == str(self.group.id)
        assert event.data == {"summary": "Assigned to you", "assignment_source": None}
        assert event.actor_type == InboxActorType.USER
        assert event.actor_id == self.user.id
        assert (
            Activity.objects.filter(group=self.group, type=ActivityType.ASSIGNED.value).count() == 1
        )

    def test_self_assignment(self) -> None:
        GroupAssignee.objects.assign(self.group, self.user, acting_user=self.user)

        assert GroupAssignee.objects.get(group=self.group).user_id == self.user.id
        assert not InboxItem.objects.exists()

    def test_team_assignment(self) -> None:
        teammate = self.create_user()
        self.create_member(organization=self.organization, user=teammate, teams=[self.team])

        GroupAssignee.objects.assign(self.group, self.team, acting_user=self.user)

        event = InboxItemEvent.objects.get()
        assert event.inbox_item.user_id == teammate.id
        assert event.data == {"summary": "Assigned to your team", "assignment_source": None}

    def test_assignment_integrations(self) -> None:
        for integration in ActivityIntegration:
            group = self.create_group(project=self.project)
            with self.subTest(integration=integration):
                GroupAssignee.objects.assign(
                    group, self.user, extra={"integration": integration.value}
                )

                event = InboxItemEvent.objects.get(inbox_item__subject_id=str(group.id))
                assert event.data["assignment_source"] == integration.value
                assert event.actor_type == InboxActorType.SYSTEM
                assert event.actor_id is None

    def test_unknown_integration_does_not_interrupt_assignment(self) -> None:
        result = GroupAssignee.objects.assign(
            self.group, self.user, extra={"integration": "unknown"}
        )

        assert result["new_assignment"] is True
        assert GroupAssignee.objects.get(group=self.group).user_id == self.user.id
        assert Activity.objects.filter(group=self.group, type=ActivityType.ASSIGNED.value).exists()
        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.ASSIGNED
        ).exists()
        assert not InboxItem.objects.exists()

    def test_comment_records_user_and_team_mentions_separately(self) -> None:
        mentioned = self.create_user()
        self.create_member(organization=self.organization, user=mentioned, teams=[self.team])
        subscriber = self.create_user()
        self.create_member(organization=self.organization, user=subscriber)
        self.create_group_subscription(group=self.group, user_id=subscriber.id)

        note = create_comment(
            group=self.group,
            user=self.user,
            data={
                "text": "Please take a look",
                "mentions": [
                    {"id": mentioned.id, "actor_type": "User"},
                    {"id": mentioned.id, "actor_type": "User"},
                    {"id": self.user.id, "actor_type": "User"},
                    {"id": self.team.id, "actor_type": "Team"},
                    {"id": self.team.id, "actor_type": "Team"},
                ],
            },
            source="web",
        )

        assert note is not None
        event = InboxItemEvent.objects.get(type="issue.user_mentioned")
        assert event.inbox_item.user_id == mentioned.id
        assert event.data == {"summary": "Mentioned you in a comment", "comment_id": note.id}
        assert event.actor_id == self.user.id
        team_event = InboxItemEvent.objects.get(type="issue.team_mentioned")
        assert team_event.inbox_item_id == event.inbox_item_id
        assert team_event.data == {
            "summary": "Mentioned your team in a comment",
            "comment_id": note.id,
        }
        assert team_event.actor_id == self.user.id

        duplicate = create_comment(
            group=self.group, user=self.user, data=dict(note.data), source="web"
        )
        assert duplicate is None
        assert InboxItemEvent.objects.count() == 2

    def test_comment_without_mentions_and_comment_edits(self) -> None:
        mentioned = self.create_user()
        self.create_member(organization=self.organization, user=mentioned, teams=[self.team])
        note = create_comment(
            group=self.group, user=self.user, data={"text": "A comment"}, source="web"
        )
        assert note is not None
        update_comment(
            note,
            user=self.user,
            data={"text": "An edit", "mentions": [{"id": mentioned.id, "actor_type": "User"}]},
            source="web",
        )

        assert not InboxItem.objects.exists()

    def test_comment_with_only_team_mentions(self) -> None:
        teammate = self.create_user()
        self.create_member(organization=self.organization, user=teammate, teams=[self.team])

        note = create_comment(
            group=self.group,
            user=self.user,
            data={
                "text": "Please take a look",
                "mentions": [{"id": self.team.id, "actor_type": "Team"}],
            },
            source="web",
        )

        assert note is not None
        event = InboxItemEvent.objects.get()
        assert event.type == "issue.team_mentioned"
        assert event.inbox_item.user_id == teammate.id
        assert event.data["comment_id"] == note.id

    def test_mentions_exclude_other_orgs_and_inactive_members(self) -> None:
        foreign_user = self.create_user()
        foreign_org = self.create_organization()
        foreign_team = self.create_team(organization=foreign_org)
        self.create_member(organization=foreign_org, user=foreign_user, teams=[foreign_team])
        inactive = self.create_user(is_active=False)
        self.create_member(organization=self.organization, user=inactive, user_is_active=False)
        former_teammate = self.create_user()
        self.create_member(organization=self.organization, user=former_teammate, teams=[self.team])
        self.team.organizationmemberteam_set.filter(
            organizationmember__user_id=former_teammate.id
        ).update(is_active=False)

        create_comment(
            group=self.group,
            user=self.user,
            data={
                "text": "A mention",
                "mentions": [
                    {"id": foreign_user.id, "actor_type": "User"},
                    {"id": foreign_team.id, "actor_type": "Team"},
                    {"id": inactive.id, "actor_type": "User"},
                    {"id": self.team.id, "actor_type": "Team"},
                ],
            },
            source="web",
        )

        assert not InboxItem.objects.exists()

    def test_pr_ready_prefers_assignee_to_suggested_owner(self) -> None:
        suggested = self.create_user()
        self.create_member(organization=self.organization, user=suggested)
        self.create_group_owner(
            group=self.group, type=GroupOwnerType.SEER_SUGGESTED.value, user_id=suggested.id
        )
        GroupAssignee.objects.assign(self.group, self.user, acting_user=self.user)
        for provider in ("email", "slack"):
            self.create_notification_settings_provider(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                provider=provider,
                type=NotificationSettingEnum.ISSUE_ALERTS.value,
                value="never",
            )

        with self.options({"issues.record-seer-actions-as-activities": True}):
            record_seer_activity(
                group=self.group,
                event_type=SentryAppEventType.SEER_PR_READY_FOR_REVIEW,
                event_payload={
                    "run_id": 123,
                    "pull_requests": [
                        {"pull_request": {"pr_url": "https://github.com/example/repo/pull/1"}}
                    ],
                },
            )

        event = InboxItemEvent.objects.get()
        assert event.inbox_item.user_id == self.user.id
        assert event.type == "issue.pr_ready_for_review"
        assert event.data == {
            "summary": "Pull request ready for review",
            "pr_url": "https://github.com/example/repo/pull/1",
            "seer_run_id": 123,
        }
        assert event.actor_type == InboxActorType.SYSTEM
        assert event.actor_id is None

    def test_pr_ready_falls_back_to_owners_and_expands_teams(self) -> None:
        teammate = self.create_user()
        self.create_member(organization=self.organization, user=teammate, teams=[self.team])
        self.create_group_owner(
            group=self.group, type=GroupOwnerType.SEER_SUGGESTED.value, user_id=self.user.id
        )
        self.create_group_owner(
            group=self.group, type=GroupOwnerType.CODEOWNERS.value, team=self.team
        )

        with self.options({"issues.record-seer-actions-as-activities": True}):
            record_seer_activity(
                group=self.group,
                event_type=SentryAppEventType.SEER_PR_READY_FOR_REVIEW,
                event_payload={
                    "run_id": 123,
                    "pull_requests": [
                        {"pull_request": {"pr_url": "https://github.com/example/repo/pull/1"}},
                        {"pull_request": {"pr_url": "https://github.com/example/repo/pull/2"}},
                    ],
                },
            )

        events = InboxItemEvent.objects.values_list("inbox_item__user_id", "data__pr_url")
        assert len(events) == 4
        assert set(events) == {
            (self.user.id, "https://github.com/example/repo/pull/1"),
            (self.user.id, "https://github.com/example/repo/pull/2"),
            (teammate.id, "https://github.com/example/repo/pull/1"),
            (teammate.id, "https://github.com/example/repo/pull/2"),
        }

    def test_pr_ready_skips_missing_pull_request_urls(self) -> None:
        self.create_group_owner(
            group=self.group, type=GroupOwnerType.SEER_SUGGESTED.value, user_id=self.user.id
        )

        with (
            self.options({"issues.record-seer-actions-as-activities": True}),
            patch("sentry.seer.entrypoints.operator.Activity.objects.create_group_activity"),
        ):
            record_seer_activity(
                group=self.group,
                event_type=SentryAppEventType.SEER_PR_READY_FOR_REVIEW,
                event_payload={
                    "run_id": 123,
                    "pull_requests": [
                        {},
                        {"pull_request": None},
                        {"pull_request": {}},
                        {"pull_request": {"pr_url": None}},
                        {"pull_request": {"pr_url": ""}},
                        {"pull_request": {"pr_url": "https://github.com/example/repo/pull/1"}},
                    ],
                },
            )

        event = InboxItemEvent.objects.get()
        assert event.data["pr_url"] == "https://github.com/example/repo/pull/1"

    def test_pr_ready_without_pull_request_list(self) -> None:
        with (
            self.options({"issues.record-seer-actions-as-activities": True}),
            patch("sentry.seer.entrypoints.operator.logger.exception") as log_exception,
        ):
            for payload in (
                {"run_id": 123},
                {"run_id": 123, "pull_requests": None},
            ):
                with self.subTest(payload=payload):
                    record_seer_activity(
                        group=self.group,
                        event_type=SentryAppEventType.SEER_PR_READY_FOR_REVIEW,
                        event_payload=payload,
                    )

        log_exception.assert_not_called()
        assert not InboxItemEvent.objects.exists()

    def test_recording_disabled_preserves_assignment_and_comments(self) -> None:
        mentioned = self.create_user()
        self.create_member(organization=self.organization, user=mentioned)
        with self.feature({"organizations:universal-inbox-recording": False}):
            GroupAssignee.objects.assign(self.group, self.user)
            note = create_comment(
                group=self.group,
                user=self.user,
                data={
                    "text": "A mention",
                    "mentions": [{"id": mentioned.id, "actor_type": "User"}],
                },
                source="web",
            )

        assert GroupAssignee.objects.get(group=self.group).user_id == self.user.id
        assert note is not None
        assert not InboxItem.objects.exists()

    def test_rollback_does_not_record_a_comment(self) -> None:
        group, user = self.group, self.user
        mentioned = self.create_user()
        self.create_member(organization=self.organization, user=mentioned, teams=[self.team])
        with pytest.raises(RuntimeError, match="rollback"):
            with transaction.atomic(using=router.db_for_write(Activity)):
                create_comment(
                    group=group,
                    user=user,
                    data={
                        "text": "A mention",
                        "mentions": [{"id": mentioned.id, "actor_type": "User"}],
                    },
                    source="web",
                )
                assert InboxItemEvent.objects.count() == 1
                raise RuntimeError("rollback")

        assert not Activity.objects.filter(group=group, type=ActivityType.NOTE.value).exists()
        assert not InboxItem.objects.exists()

    def test_recording_failure_does_not_fail_assignment(self) -> None:
        with patch(
            "sentry.inbox.issue.InboxEventType.record", side_effect=RuntimeError("write failed")
        ):
            GroupAssignee.objects.assign(self.group, self.user)

        assert GroupAssignee.objects.get(group=self.group).user_id == self.user.id
        assert Activity.objects.filter(group=self.group, type=ActivityType.ASSIGNED.value).exists()

    def test_recording_failure_does_not_roll_back_comment(self) -> None:
        mentioned = self.create_user()
        self.create_member(organization=self.organization, user=mentioned)

        with patch(
            "sentry.inbox.types.InboxItemEvent.objects.create",
            side_effect=IntegrityError("write failed"),
        ):
            note = create_comment(
                group=self.group,
                user=self.user,
                data={
                    "text": "A mention",
                    "mentions": [{"id": mentioned.id, "actor_type": "User"}],
                },
                source="web",
            )

        assert note is not None
        assert Activity.objects.filter(id=note.id).exists()
        assert not InboxItem.objects.exists()
