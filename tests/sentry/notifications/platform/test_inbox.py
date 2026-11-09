from unittest.mock import MagicMock, patch

from django.db import router, transaction

from sentry.inbox.issue import ISSUE_USER_MENTIONED, IssueMentionedData
from sentry.inbox.types import SYSTEM_ACTOR, InboxActor
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.notifications.platform.inbox import (
    create_inbox_items,
    get_inbox_notification_targets,
    send_inbox_notifications,
)
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.templates.inbox import InboxItemNotificationData
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.slack import add_identity, install_slack
from sentry.types.actor import Actor


@with_feature("organizations:universal-inbox-recording")
class CreateInboxItemsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.subject = self.create_group(project=self.project)

    def _create(self, recipients: list[Actor], actor: InboxActor = SYSTEM_ACTOR) -> None:
        create_inbox_items(
            event_type=ISSUE_USER_MENTIONED,
            subject=self.subject,
            data=IssueMentionedData(summary="Mentioned you in a comment", comment_id=123),
            recipients=recipients,
            actor=actor,
        )

    def _recorded_user_ids(self) -> list[int]:
        return sorted(InboxItemEvent.objects.values_list("inbox_item__user_id", flat=True))

    @patch("sentry.notifications.platform.inbox.send_inbox_notifications.delay")
    def test_records_without_notifying_when_flag_off(self, delay: MagicMock) -> None:
        self._create([Actor.from_object(self.user)])

        assert self._recorded_user_ids() == [self.user.id]
        delay.assert_not_called()

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

    @with_feature("organizations:inbox-notifications")
    @patch("sentry.notifications.platform.inbox.send_inbox_notifications.delay")
    def test_notifies_recorded_events_after_commit(self, delay: MagicMock) -> None:
        other = self.create_user()
        self.create_member(organization=self.organization, user=other)
        recipients = [Actor.from_object(self.user), Actor.from_object(other)]

        with transaction.atomic(using=router.db_for_write(InboxItemEvent)):
            self._create(recipients)
            delay.assert_not_called()

        event_ids = sorted(InboxItemEvent.objects.values_list("id", flat=True))
        assert len(event_ids) == 2
        delay.assert_called_once()
        assert sorted(delay.call_args.kwargs["event_ids"]) == event_ids

    @with_feature("organizations:inbox-notifications")
    @patch("sentry.notifications.platform.inbox.send_inbox_notifications.delay")
    def test_nothing_recorded(self, delay: MagicMock) -> None:
        self._create([Actor.from_object(self.user)], actor=InboxActor.user(self.user.id))

        assert not InboxItemEvent.objects.exists()
        delay.assert_not_called()


class GetInboxNotificationTargetsTest(TestCase):
    def test_email_and_slack_targets_by_user(self) -> None:
        integration = install_slack(self.organization)
        add_identity(integration, self.user, external_id="UXXXXXXX1")
        other = self.create_user(email="other@example.com")
        self.create_member(organization=self.organization, user=other)

        targets = get_inbox_notification_targets(
            organization_id=self.organization.id, user_ids=[self.user.id, other.id]
        )

        assert {target.provider_key for target in targets[self.user.id]} == {
            NotificationProviderKey.EMAIL,
            NotificationProviderKey.SLACK,
        }
        slack_target = next(
            target
            for target in targets[self.user.id]
            if target.provider_key == NotificationProviderKey.SLACK
        )
        assert isinstance(slack_target, IntegrationNotificationTarget)
        assert slack_target.resource_type == NotificationTargetResourceType.DIRECT_MESSAGE
        assert slack_target.resource_id == "UXXXXXXX1"
        assert [target.resource_id for target in targets[other.id]] == ["other@example.com"]


@with_feature("organizations:universal-inbox-recording")
@patch("sentry.notifications.platform.inbox.NotificationService.notify_async", autospec=True)
class SendInboxNotificationsTest(TestCase):
    def _record(self, recipient_user_ids: list[int], actor: InboxActor = SYSTEM_ACTOR) -> list[int]:
        events = ISSUE_USER_MENTIONED.record(
            subject=self.group,
            data=IssueMentionedData(summary="Mentioned you in a comment", comment_id=123),
            recipient_user_ids=recipient_user_ids,
            actor=actor,
        )
        return [event.id for event in events]

    def test_sends_to_each_recipient(self, notify_async: MagicMock) -> None:
        actor = self.create_user(name="Jane Doe")
        other = self.create_user(email="other@example.com")
        event_ids = self._record([self.user.id, other.id], actor=InboxActor.user(actor.id))

        send_inbox_notifications(event_ids=event_ids)

        assert notify_async.call_count == 2
        sent = {
            call.kwargs["targets"][0].resource_id: call.args[0].data
            for call in notify_async.call_args_list
        }
        assert set(sent) == {self.user.email, "other@example.com"}
        data = sent[self.user.email]
        assert isinstance(data, InboxItemNotificationData)
        item = InboxItemEvent.objects.get(inbox_item__user_id=self.user.id).inbox_item
        assert data == InboxItemNotificationData(
            organization_id=self.organization.id,
            notification_uuid=data.notification_uuid,
            inbox_item_id=item.id,
            event_type="issue.user_mentioned",
            subject_title=self.group.title,
            summary="Mentioned you in a comment",
            actor_name="Jane Doe",
            inbox_url=self.organization.absolute_url(
                f"/organizations/{self.organization.slug}/inbox/issue/{self.group.id}/"
            ),
        )

    def test_system_actor_name(self, notify_async: MagicMock) -> None:
        send_inbox_notifications(event_ids=self._record([self.user.id]))

        assert notify_async.call_args.args[0].data.actor_name == "Sentry"

    def test_deleted_actor_name(self, notify_async: MagicMock) -> None:
        send_inbox_notifications(event_ids=self._record([self.user.id], actor=InboxActor.user(0)))

        assert notify_async.call_args.args[0].data.actor_name == "A former member"

    def test_skips_deleted_subject(self, notify_async: MagicMock) -> None:
        event_ids = self._record([self.user.id])
        self.group.delete()

        send_inbox_notifications(event_ids=event_ids)

        notify_async.assert_not_called()

    def test_skips_missing_events(self, notify_async: MagicMock) -> None:
        send_inbox_notifications(event_ids=[0])

        notify_async.assert_not_called()
