from unittest.mock import MagicMock, patch

from django.db import router, transaction

from sentry.inbox.issue import (
    ISSUE_PR_READY_FOR_REVIEW,
    ISSUE_USER_MENTIONED,
    IssueMentionedData,
    IssuePRReadyForReviewData,
)
from sentry.inbox.types import SYSTEM_ACTOR, InboxActor
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.notifications.platform.inbox import INBOX_NOTIFIERS, create_inbox_items
from sentry.notifications.types import NotificationSettingEnum
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor

MENTION_DATA = IssueMentionedData(summary="Mentioned you in a comment", comment_id=123)


@with_feature("organizations:universal-inbox-recording")
class CreateInboxItemsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.subject = self.create_group(project=self.project)

    def _create(self, recipients: list[Actor], actor: InboxActor = SYSTEM_ACTOR) -> None:
        create_inbox_items(
            event_type=ISSUE_USER_MENTIONED,
            subject=self.subject,
            data=MENTION_DATA,
            recipients=recipients,
            actor=actor,
        )

    def _recorded_user_ids(self) -> list[int]:
        return sorted(InboxItemEvent.objects.values_list("inbox_item__user_id", flat=True))

    def test_records_for_users(self) -> None:
        other = self.create_user()
        self.create_member(organization=self.organization, user=other)

        self._create([Actor.from_object(self.user), Actor.from_object(other)])

        assert self._recorded_user_ids() == sorted([self.user.id, other.id])

    def test_expands_teams_to_active_members(self) -> None:
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        inactive_member = self.create_user()
        self.create_member(organization=self.organization, user=member, teams=[team])
        self.create_member(organization=self.organization, user=inactive_member, teams=[team])
        OrganizationMemberTeam.objects.filter(
            team=team, organizationmember__user_id=inactive_member.id
        ).update(is_active=False)

        self._create([Actor.from_object(team)])

        assert self._recorded_user_ids() == [member.id]

    def test_user_reached_directly_and_through_team_gets_one_event(self) -> None:
        team = self.create_team(organization=self.organization, members=[self.user])

        self._create([Actor.from_object(self.user), Actor.from_object(team)])

        assert self._recorded_user_ids() == [self.user.id]

    def test_drops_recipients_outside_organization(self) -> None:
        other_organization = self.create_organization()
        outsider = self.create_user()
        other_team = self.create_team(organization=other_organization)
        self.create_member(organization=other_organization, user=outsider, teams=[other_team])

        self._create([Actor.from_object(outsider), Actor.from_object(other_team)])

        assert not InboxItemEvent.objects.exists()

    def test_excludes_actor(self) -> None:
        self._create([Actor.from_object(self.user)], actor=InboxActor.user(self.user.id))

        assert not InboxItemEvent.objects.exists()

    @patch("sentry.notifications.platform.inbox.IssueActivityInboxNotifier.notify")
    def test_does_not_notify_when_flag_off(self, notify: MagicMock) -> None:
        self._create([Actor.from_object(self.user)])

        assert self._recorded_user_ids() == [self.user.id]
        notify.assert_not_called()

    @with_feature("organizations:inbox-notifications")
    @patch("sentry.notifications.platform.inbox.IssueActivityInboxNotifier.notify")
    def test_notifies_recorded_users_after_commit(self, notify: MagicMock) -> None:
        actor = self.create_user()
        other = self.create_user()
        self.create_member(organization=self.organization, user=other)
        recipients = [Actor.from_object(self.user), Actor.from_object(other)]

        with transaction.atomic(using=router.db_for_write(InboxItemEvent)):
            self._create([*recipients, Actor.from_object(actor)], actor=InboxActor.user(actor.id))
            notify.assert_not_called()

        notify.assert_called_once()
        assert notify.call_args.kwargs["subject"] == self.subject
        assert notify.call_args.kwargs["data"] == MENTION_DATA
        assert sorted(notify.call_args.kwargs["user_ids"]) == sorted([self.user.id, other.id])

    @with_feature("organizations:inbox-notifications")
    @patch("sentry.notifications.platform.inbox.IssueActivityInboxNotifier.notify")
    def test_does_not_notify_when_nothing_recorded(self, notify: MagicMock) -> None:
        self._create([Actor.from_object(self.user)], actor=InboxActor.user(self.user.id))

        notify.assert_not_called()

    @with_feature("organizations:inbox-notifications")
    @patch("sentry.notifications.platform.inbox.IssueActivityInboxNotifier.notify")
    def test_event_type_without_notifier_only_records(self, notify: MagicMock) -> None:
        create_inbox_items(
            event_type=ISSUE_PR_READY_FOR_REVIEW,
            subject=self.subject,
            data=IssuePRReadyForReviewData(
                summary="PR ready for review", pr_url="https://github.com/pr/1", seer_run_id=1
            ),
            recipients=[Actor.from_object(self.user)],
            actor=SYSTEM_ACTOR,
        )

        assert self._recorded_user_ids() == [self.user.id]
        notify.assert_not_called()


@patch("sentry.notifications.platform.strategies.actor_routing.UserRoutingStrategy")
class MentionNotifierTest(TestCase):
    def test_routes_to_users_with_workflow_settings(self, strategy: MagicMock) -> None:
        note = self.create_group_activity(
            self.group, type=ActivityType.NOTE.value, user_id=self.user.id
        )
        notifier = INBOX_NOTIFIERS[ISSUE_USER_MENTIONED.event_type]

        notifier.notify(
            subject=self.group,
            data=IssueMentionedData(summary="Mentioned you in a comment", comment_id=note.id),
            user_ids=[self.user.id],
        )

        strategy.assert_called_once_with(
            project=self.group.project,
            user_ids=[self.user.id],
            settings_key=NotificationSettingEnum.WORKFLOW,
        )
        strategy.return_value.get_targets.assert_called_once_with()

    def test_skips_missing_activity(self, strategy: MagicMock) -> None:
        notifier = INBOX_NOTIFIERS[ISSUE_USER_MENTIONED.event_type]

        notifier.notify(subject=self.group, data=MENTION_DATA, user_ids=[self.user.id])

        strategy.assert_not_called()
