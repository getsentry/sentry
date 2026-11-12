from collections.abc import Sequence
from typing import Any
from unittest.mock import MagicMock, patch

from sentry.inbox.issue import (
    ISSUE,
    ISSUE_PR_READY_FOR_REVIEW,
    ISSUE_TEAM_MENTIONED,
    ISSUE_USER_MENTIONED,
    IssueMentionedData,
    IssuePRReadyForReviewData,
)
from sentry.inbox.types import SYSTEM_ACTOR, InboxActor
from sentry.integrations.types import ExternalProviders
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.notifications.activity.note import NoteActivityNotification
from sentry.notifications.platform.inbox import create_inbox_items, get_inbox_notified_user_ids
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.types import NotificationSource
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.types.activity import ActivityType
from sentry.types.actor import ActorType

INBOX_FEATURES = [
    "organizations:universal-inbox-recording",
    "organizations:universal-inbox-notifications",
]


class CreateInboxItemsTest(TestCase):
    def _create(
        self,
        *,
        user_ids: Sequence[int] = (),
        team_ids: Sequence[int] = (),
        actor: InboxActor = SYSTEM_ACTOR,
    ) -> None:
        create_inbox_items(
            event_type=ISSUE_USER_MENTIONED,
            subject=self.group,
            data=IssueMentionedData(comment_id=123),
            user_ids=user_ids,
            team_ids=team_ids,
            actor=actor,
        )

    def _recorded_user_ids(self) -> list[int]:
        return sorted(InboxItemEvent.objects.values_list("inbox_item__user_id", flat=True))

    def test_records_nothing_when_recording_disabled(self) -> None:
        self._create(user_ids=[self.user.id])

        assert not InboxItemEvent.objects.exists()

    @with_feature("organizations:universal-inbox-recording")
    def test_records_for_users(self) -> None:
        other = self.create_user()
        self.create_member(organization=self.organization, user=other)

        self._create(user_ids=[self.user.id, other.id])

        assert self._recorded_user_ids() == sorted([self.user.id, other.id])

    @with_feature("organizations:universal-inbox-recording")
    def test_expands_teams_to_active_members(self) -> None:
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        inactive_member = self.create_user()
        self.create_member(organization=self.organization, user=member, teams=[team])
        self.create_member(organization=self.organization, user=inactive_member, teams=[team])
        OrganizationMemberTeam.objects.filter(
            team=team, organizationmember__user_id=inactive_member.id
        ).update(is_active=False)

        self._create(team_ids=[team.id])

        assert self._recorded_user_ids() == [member.id]

    @with_feature("organizations:universal-inbox-recording")
    def test_user_reached_directly_and_through_team_gets_one_event(self) -> None:
        team = self.create_team(organization=self.organization, members=[self.user])

        self._create(user_ids=[self.user.id], team_ids=[team.id])

        assert self._recorded_user_ids() == [self.user.id]

    @with_feature("organizations:universal-inbox-recording")
    def test_drops_recipients_outside_organization(self) -> None:
        other_organization = self.create_organization()
        outsider = self.create_user()
        other_team = self.create_team(organization=other_organization)
        self.create_member(organization=other_organization, user=outsider, teams=[other_team])

        self._create(user_ids=[outsider.id], team_ids=[other_team.id])

        assert not InboxItemEvent.objects.exists()

    @with_feature("organizations:universal-inbox-recording")
    def test_drops_recipients_the_item_type_filters_out(self) -> None:
        other = self.create_user()
        self.create_member(organization=self.organization, user=other)

        with patch.object(
            ISSUE, "filter_recipients", return_value=[other.id], autospec=True
        ) as filter_recipients:
            self._create(user_ids=[self.user.id, other.id])

        assert self._recorded_user_ids() == [other.id]
        assert filter_recipients.call_args.kwargs["subject"] == self.group
        assert sorted(filter_recipients.call_args.kwargs["user_ids"]) == sorted(
            [self.user.id, other.id]
        )

    @with_feature("organizations:universal-inbox-recording")
    def test_excludes_actor(self) -> None:
        self._create(user_ids=[self.user.id], actor=InboxActor.user(self.user.id))

        assert not InboxItemEvent.objects.exists()


def _sent(notify_async: MagicMock) -> list[tuple[str, str]]:
    return [
        (call.args[0].data.source, target.resource_id)
        for call in notify_async.call_args_list
        for target in call.kwargs["targets"]
    ]


@patch.object(NotificationService, "notify_async", autospec=True)
class InboxNotificationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.recipient = self.create_user(email="recipient@example.com")
        self.create_member(organization=self.organization, user=self.recipient)

    def _mention(self) -> None:
        note = self.create_group_activity(
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={
                "text": "hi",
                "mentions": [{"id": self.recipient.id, "actor_type": ActorType.USER.value}],
            },
        )
        create_inbox_items(
            event_type=ISSUE_USER_MENTIONED,
            subject=self.group,
            data=IssueMentionedData(comment_id=note.id),
            user_ids=[self.recipient.id],
            actor=InboxActor.user(self.user.id),
        )

    @with_feature(INBOX_FEATURES)
    def test_mention_notifies_recipient(self, notify_async: MagicMock) -> None:
        self._mention()

        assert _sent(notify_async) == [(NotificationSource.ACTIVITY_NOTE, "recipient@example.com")]

    @with_feature(INBOX_FEATURES)
    def test_assignment_notifies_assignee(self, notify_async: MagicMock) -> None:
        GroupAssignee.objects.assign(self.group, self.recipient, acting_user=self.user)

        assert _sent(notify_async) == [
            (NotificationSource.ACTIVITY_ASSIGNED, "recipient@example.com")
        ]

    def _pr_ready(self, pr_urls: Sequence[str]) -> None:
        activity = self.create_group_activity(
            type=ActivityType.SEER_PR_READY_FOR_REVIEW.value,
            data={
                "pull_requests": [
                    {"repo_name": "example/repo", "pull_request": {"pr_url": pr_url}}
                    for pr_url in pr_urls
                ]
            },
        )
        for pr_url in pr_urls:
            create_inbox_items(
                event_type=ISSUE_PR_READY_FOR_REVIEW,
                subject=self.group,
                data=IssuePRReadyForReviewData(
                    activity_id=activity.id,
                    pr_url=pr_url,
                    seer_run_id=1,
                ),
                user_ids=[self.recipient.id],
                actor=SYSTEM_ACTOR,
            )

    @with_feature(INBOX_FEATURES)
    def test_pr_ready_notifies_recipient(self, notify_async: MagicMock) -> None:
        self._pr_ready(["https://github.com/example/repo/pull/1"])

        assert _sent(notify_async) == [
            (NotificationSource.ACTIVITY_SEER_PR_READY_FOR_REVIEW, "recipient@example.com")
        ]

    @with_feature(INBOX_FEATURES)
    def test_several_pull_requests_notify_once(self, notify_async: MagicMock) -> None:
        self._pr_ready(
            ["https://github.com/example/repo/pull/1", "https://github.com/example/repo/pull/2"]
        )

        assert InboxItemEvent.objects.count() == 2
        assert _sent(notify_async) == [
            (NotificationSource.ACTIVITY_SEER_PR_READY_FOR_REVIEW, "recipient@example.com")
        ]

    @with_feature(INBOX_FEATURES)
    def test_user_and_team_mention_notify_once(self, notify_async: MagicMock) -> None:
        team = self.create_team(organization=self.organization, members=[self.recipient])
        note = self.create_group_activity(
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={
                "text": "hi",
                "mentions": [
                    {"id": self.recipient.id, "actor_type": ActorType.USER.value},
                    {"id": team.id, "actor_type": ActorType.TEAM.value},
                ],
            },
        )
        for event_type, recipients in (
            (ISSUE_USER_MENTIONED, {"user_ids": [self.recipient.id]}),
            (ISSUE_TEAM_MENTIONED, {"team_ids": [team.id]}),
        ):
            create_inbox_items(
                event_type=event_type,
                subject=self.group,
                data=IssueMentionedData(comment_id=note.id),
                actor=InboxActor.user(self.user.id),
                **recipients,
            )

        assert InboxItemEvent.objects.count() == 2
        assert _sent(notify_async) == [(NotificationSource.ACTIVITY_NOTE, "recipient@example.com")]

    @with_feature(INBOX_FEATURES)
    def test_links_to_inbox_item_and_inbox_settings(self, notify_async: MagicMock) -> None:
        self._mention()

        data = notify_async.call_args.args[0].data
        assert data.issue_url == self.organization.absolute_url(
            f"/organizations/{self.organization.slug}/inbox/issue/{self.group.id}/",
            query="referrer=activity_notification",
        )
        assert data.user_settings_url == self.organization.absolute_url(
            "settings/account/notifications/inbox/", query="referrer=activity_notification"
        )

    @with_feature(INBOX_FEATURES)
    def test_respects_inbox_notification_setting(self, notify_async: MagicMock) -> None:
        with assume_test_silo_mode_of(NotificationSettingOption):
            NotificationSettingOption.objects.create(
                user_id=self.recipient.id,
                scope_type=NotificationScopeEnum.USER.value,
                scope_identifier=self.recipient.id,
                type=NotificationSettingEnum.INBOX_MENTIONS.value,
                value=NotificationSettingsOptionEnum.NEVER.value,
            )

        self._mention()

        assert InboxItemEvent.objects.filter(inbox_item__user_id=self.recipient.id).exists()
        assert _sent(notify_async) == []

    @with_feature("organizations:universal-inbox-recording")
    def test_records_without_notifying_when_notifications_disabled(
        self, notify_async: MagicMock
    ) -> None:
        self._mention()

        assert InboxItemEvent.objects.filter(inbox_item__user_id=self.recipient.id).exists()
        assert _sent(notify_async) == []


class GetInboxNotifiedUserIdsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.recipient = self.create_user()
        self.create_member(organization=self.organization, user=self.recipient, teams=[self.team])

    def _activity(self, activity_type: ActivityType, data: dict[str, Any]) -> set[int]:
        activity = self.create_group_activity(type=activity_type.value, data=data)
        return get_inbox_notified_user_ids(activity)

    @with_feature(INBOX_FEATURES)
    def test_user_assignment(self) -> None:
        assert self._activity(
            ActivityType.ASSIGNED, {"assignee": str(self.recipient.id), "assigneeType": "user"}
        ) == {self.recipient.id}

    @with_feature(INBOX_FEATURES)
    def test_team_assignment(self) -> None:
        assert self._activity(
            ActivityType.ASSIGNED, {"assignee": str(self.team.id), "assigneeType": "team"}
        ) == {self.user.id, self.recipient.id}

    @with_feature(INBOX_FEATURES)
    def test_mentions(self) -> None:
        mentioned = self.create_user()
        self.create_member(organization=self.organization, user=mentioned)

        assert self._activity(
            ActivityType.NOTE,
            {
                "text": "hi",
                "mentions": [
                    {"id": mentioned.id, "actor_type": ActorType.USER.value},
                    {"id": self.team.id, "actor_type": ActorType.TEAM.value},
                ],
            },
        ) == {mentioned.id, self.user.id, self.recipient.id}

    @with_feature(INBOX_FEATURES)
    def test_other_activity_types(self) -> None:
        assert self._activity(ActivityType.SET_RESOLVED, {}) == set()

    @with_feature(INBOX_FEATURES)
    def test_legacy_activity_notification_excludes_inbox_recipients(self) -> None:
        subscriber = self.create_user()
        self.create_member(organization=self.organization, user=subscriber, teams=[self.team])
        for user in (self.recipient, subscriber):
            self.create_group_subscription(group=self.group, user_id=user.id, is_active=True)
        activity = self.create_group_activity(
            type=ActivityType.NOTE.value,
            data={
                "text": "hi",
                "mentions": [{"id": self.recipient.id, "actor_type": ActorType.USER.value}],
            },
        )

        participants = NoteActivityNotification(
            activity
        ).get_participants_with_group_subscription_reason()

        assert {
            actor.id
            for actor, _ in participants.get_participants_by_provider(ExternalProviders.EMAIL)
        } == {subscriber.id}

    @with_feature("organizations:universal-inbox-recording")
    def test_empty_when_notifications_disabled(self) -> None:
        assert (
            self._activity(
                ActivityType.ASSIGNED, {"assignee": str(self.recipient.id), "assigneeType": "user"}
            )
            == set()
        )
