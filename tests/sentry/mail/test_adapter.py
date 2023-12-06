import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from functools import cached_property
from typing import Mapping, Sequence
from unittest import mock
from unittest.mock import ANY

import pytz
from django.contrib.auth.models import AnonymousUser
from django.core import mail
from django.core.mail.message import EmailMultiAlternatives
from django.db.models import F
from django.utils import timezone as django_timezone

from sentry.api.serializers import serialize
from sentry.api.serializers.models.userreport import UserReportWithGroupSerializer
from sentry.digests.notifications import build_digest, event_to_record
from sentry.event_manager import EventManager, get_event_type
from sentry.issues.grouptype import MonitorCheckInFailure
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.mail import build_subject_prefix, mail_adapter
from sentry.models.activity import Activity
from sentry.models.grouprelease import GroupRelease
from sentry.models.integrations.integration import Integration
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.options.project_option import ProjectOption
from sentry.models.options.user_option import UserOption
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.repository import Repository
from sentry.models.rule import Rule
from sentry.models.useremail import UserEmail
from sentry.models.userreport import UserReport
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.types import ActionTargetType
from sentry.notifications.utils.digest import get_digest_subject
from sentry.ownership import grammar
from sentry.ownership.grammar import Matcher, Owner, dump_schema
from sentry.plugins.base import Notification
from sentry.replays.testutils import mock_replay
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.silo import SiloMode
from sentry.testutils.cases import PerformanceIssueTestCase, ReplaysSnubaTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.types.rules import RuleFuture
from sentry.utils.dates import ensure_aware
from sentry.utils.email import MessageBuilder, get_email_addresses
from sentry_plugins.opsgenie.plugin import OpsGeniePlugin
from tests.sentry.mail import make_event_data, mock_notify

pytestmark = requires_snuba


class BaseMailAdapterTest(TestCase, PerformanceIssueTestCase):
    @cached_property
    def adapter(self):
        return mail_adapter

    def assert_notify(
        self,
        event,
        emails_sent_to,
        target_type=ActionTargetType.ISSUE_OWNERS,
        target_identifier=None,
    ):
        mail.outbox = []
        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(Notification(event=event), target_type, target_identifier)
        assert sorted(email.to[0] for email in mail.outbox) == sorted(emails_sent_to)


@region_silo_test
class MailAdapterGetSendableUsersTest(BaseMailAdapterTest):
    def test_get_sendable_user_objects(self):
        user = self.create_user(email="foo@example.com", is_active=True)
        user2 = self.create_user(email="baz@example.com", is_active=True)
        self.create_user(email="baz2@example.com", is_active=True)

        # user with inactive account
        self.create_user(email="bar@example.com", is_active=False)
        # user not in any groups
        self.create_user(email="bar2@example.com", is_active=True)

        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)

        project = self.create_project(name="Test", teams=[team])
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(
                user_id=user.id, organization=organization
            ),
            team=team,
        )
        self.create_member(user=user2, organization=organization, teams=[team])

        # all members
        users = self.adapter.get_sendable_user_objects(project)
        assert sorted({user.id, user2.id}) == sorted(user.id for user in users)

        # disabled user2
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=user2.id,
                scope_type="project",
                scope_identifier=project.id,
                type="alerts",
                value="never",
            )
        assert user2 not in self.adapter.get_sendable_user_objects(project)

        user4 = self.create_user(username="baz4", email="bar@example.com", is_active=True)
        self.create_member(user=user4, organization=organization, teams=[team])
        assert user4.id in {u.id for u in self.adapter.get_sendable_user_objects(project)}

        # disabled by default user4
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=user4.id,
                scope_type="user",
                scope_identifier=user4.id,
                type="alerts",
                value="never",
            )

        assert user4 not in self.adapter.get_sendable_user_objects(project)

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=user4.id,
                scope_type="user",
                scope_identifier=user4.id,
                type="alerts",
            ).update(value="never")

        assert user4.id not in {u.id for u in self.adapter.get_sendable_user_objects(project)}


@region_silo_test
class MailAdapterBuildSubjectPrefixTest(BaseMailAdapterTest):
    def test_default_prefix(self):
        assert build_subject_prefix(self.project) == "[Sentry]"

    def test_project_level_prefix(self):
        prefix = "[Example prefix]"
        ProjectOption.objects.set_value(
            project=self.project, key="mail:subject_prefix", value=prefix
        )
        assert build_subject_prefix(self.project) == prefix


@region_silo_test
class MailAdapterNotifyTest(BaseMailAdapterTest):
    @mock.patch("sentry.analytics.record")
    def test_simple_notification(self, mock_record):
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )

        rule = Rule.objects.create(project=self.project, label="my rule")
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        assert msg.subject == "[Sentry] BAR-1 - Hello world"
        assert isinstance(msg.alternatives[0][0], str)
        assert "my rule" in msg.alternatives[0][0]
        assert "notification_uuid" in msg.body
        mock_record.assert_any_call(
            "integrations.email.notification_sent",
            category="issue_alert",
            target_type=ANY,
            target_identifier=None,
            project_id=self.project.id,
            organization_id=self.organization.id,
            group_id=event.group_id,
            user_id=ANY,
            id=ANY,
            actor_type="User",
            notification_uuid=ANY,
            alert_id=rule.id,
        )
        mock_record.assert_called_with(
            "alert.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            provider="email",
            alert_id=rule.id,
            alert_type="issue_alert",
            external_id=ANY,
            notification_uuid=ANY,
        )

    def test_notification_with_environment(self):
        environment = self.create_environment(self.project, name="production")
        event = self.store_event(
            data={"message": "Hello world", "level": "error", "environment": environment.name},
            project_id=self.project.id,
        )

        rule = Rule.objects.create(
            project=self.project, label="my rule", environment_id=environment.id
        )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        assert msg.subject == "[Sentry] BAR-1 - Hello world"
        assert isinstance(msg.alternatives[0][0], str)
        assert "my rule" in msg.alternatives[0][0]
        assert f"&environment={environment.name}" in msg.body
        assert "notification_uuid" in msg.body

    def test_simple_snooze(self):
        """Test that notification for alert snoozed by user is not send to that user."""
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )

        rule = self.create_project_rule(project=self.project)
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=rule)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) == 0

    def test_snooze_for_all(self):
        """Test that notification for alert snoozed for everyone is not send to user."""
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )

        rule = self.create_project_rule(project=self.project)
        self.snooze_rule(owner_id=self.user.id, rule=rule)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) == 0

    def test_someone_else_snoozes_themself(self):
        """Test that notification for alert snoozed by user2 for themself is sent to user"""
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )

        rule = self.create_project_rule(project=self.project)
        user2 = self.create_user(email="otheruser@example.com")
        self.snooze_rule(user_id=user2.id, owner_id=user2.id, rule=rule)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.subject == "[Sentry] BAR-1 - Hello world"

    def test_someone_else_snoozes_everyone(self):
        """Test that notification for alert snoozed by user2 for everyone is not sent to user"""
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )

        rule = self.create_project_rule(project=self.project)
        user2 = self.create_user(email="otheruser@example.com")
        self.snooze_rule(owner_id=user2.id, rule=rule)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) == 0

    def test_simple_notification_generic(self):
        """Test that an issue that is neither error nor performance type renders a generic email template"""
        orig_event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        event = orig_event.for_group(orig_event.groups[0])
        occurrence = IssueOccurrence(
            uuid.uuid4().hex,
            self.project.id,
            uuid.uuid4().hex,
            ["some-fingerprint"],
            "something bad happened",
            "it was bad",
            "1234",
            {"Test": 123},
            [
                IssueEvidence("Evidence 1", "Value 1", True),
                IssueEvidence("Evidence 2", "Value 2", False),
                IssueEvidence("Evidence 3", "Value 3", False),
            ],
            MonitorCheckInFailure,
            ensure_aware(datetime.now()),
            "info",
            "/api/123",
        )
        occurrence.save()
        event.occurrence = occurrence

        event.group.type = MonitorCheckInFailure.type_id

        rule = Rule.objects.create(project=self.project, label="my rule")
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        assert msg.subject == f"[Sentry] BAR-1 - {occurrence.issue_title}"
        checked_values = [
            "Issue Data",
            "Evidence 1",
            "Value 1",
            "Evidence 2",
            "Value 2",
            "Evidence 3",
            "Value 3",
        ]
        for checked_value in checked_values:
            assert isinstance(msg.alternatives[0][0], str)
            assert (
                checked_value in msg.alternatives[0][0]
            ), f"{checked_value} not present in message"

    def test_simple_notification_generic_no_evidence(self):
        """Test that an issue with no evidence that is neither error nor performance type renders a generic email template"""
        orig_event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        event = orig_event.for_group(orig_event.groups[0])
        occurrence = IssueOccurrence(
            uuid.uuid4().hex,
            self.project.id,
            uuid.uuid4().hex,
            ["some-fingerprint"],
            "something bad happened",
            "it was bad",
            "1234",
            {"Test": 123},
            [],  # no evidence
            MonitorCheckInFailure,
            ensure_aware(datetime.now()),
            "info",
            "/api/123",
        )
        occurrence.save()
        event.occurrence = occurrence

        event.group.type = MonitorCheckInFailure.type_id

        rule = Rule.objects.create(project=self.project, label="my rule")
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        assert msg.subject == "[Sentry] BAR-1 - something bad happened"
        assert isinstance(msg.alternatives[0][0], str)
        assert "Issue Data" not in msg.alternatives[0][0]

    def test_simple_notification_perf(self):
        event = self.create_performance_issue()
        rule = Rule.objects.create(project=self.project, label="my rule")
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        assert msg.subject == "[Sentry] BAR-1 - N+1 Query"
        checked_values = [
            "Transaction Name",
            # TODO: Not sure if this is right
            "db - SELECT `books_author`.`id`, `books_author`.`",
            "Parent Span",
            "django.view - index",
            "Repeating Spans (10)",
            "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_autho...",
        ]
        for checked_value in checked_values:
            assert isinstance(msg.alternatives[0][0], str)
            assert (
                checked_value in msg.alternatives[0][0]
            ), f"{checked_value} not present in message"
        assert "notification_uuid" in msg.body

    @mock.patch("sentry.interfaces.stacktrace.Stacktrace.get_title")
    @mock.patch("sentry.interfaces.stacktrace.Stacktrace.to_email_html")
    def test_notify_users_renders_interfaces_with_utf8(self, _to_email_html, _get_title):
        _to_email_html.return_value = "רונית מגן"
        _get_title.return_value = "Stacktrace"

        event = self.store_event(
            data={"message": "Soubor ji\xc5\xbe existuje", "stacktrace": {"frames": [{}]}},
            project_id=self.project.id,
        )

        notification = Notification(event=event)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        with self.options({"system.url-prefix": "http://example.com"}):
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        _get_title.assert_called_once_with()
        _to_email_html.assert_called_once_with(event)

    @mock_notify
    @mock.patch("sentry.notifications.notifications.rules.logger")
    def test_notify_users_does_email(self, mock_logger, mock_func):
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserOption.objects.create(user=self.user, key="timezone", value="Europe/Vienna")
        event_manager = EventManager({"message": "hello world", "level": "error"})
        event_manager.normalize()
        event_data = event_manager.get_data()
        event_type = get_event_type(event_data)
        event_data["type"] = event_type.key
        event_data["metadata"] = event_type.get_metadata(event_data)

        event = event_manager.save(self.project.id)
        group = event.group

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                provider="slack",
                type="alerts",
                value="never",
            )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        with self.tasks():
            AlertRuleNotification(Notification(event=event), ActionTargetType.ISSUE_OWNERS).send()

        assert mock_func.call_count == 1

        args, kwargs = mock_func.call_args
        notification = args[1]

        recipient_context = notification.get_recipient_context(
            RpcActor.from_orm_user(self.user), {}
        )
        assert recipient_context["timezone"] == pytz.timezone("Europe/Vienna")

        self.assertEqual(notification.project, self.project)
        self.assertEqual(notification.reference, group)
        assert notification.get_subject() == "BAR-1 - hello world"

        assert group
        mock_logger.info.assert_called_with(
            "mail.adapter.notify",
            extra={
                "target_type": "IssueOwners",
                "target_identifier": None,
                "group": group.id,
                "project_id": group.project.id,
                "organization": group.organization.id,
                "fallthrough_choice": None,
                "notification_uuid": mock.ANY,
            },
        )

    @mock_notify
    def test_email_notification_is_not_sent_to_deleted_email(self, mock_func):
        """
        Test that ensures if we still have some stale emails in UserOption, then upon attempting
        to send an email notification to those emails, these stale `UserOption` instances are
        deleted
        """
        # Initial Creation
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        user = self.create_user(email="foo@bar.dodo", is_active=True)
        self.create_member(user=user, organization=self.organization, teams=[self.team])

        with assume_test_silo_mode(SiloMode.CONTROL):
            UserOption.objects.create(
                user=user, key="mail:email", value="foo@bar.dodo", project_id=self.project.id
            )
            # disable slack
            NotificationSettingProvider.objects.create(
                user_id=user.id,
                scope_type="user",
                scope_identifier=user.id,
                provider="slack",
                type="alerts",
                value="never",
            )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        with assume_test_silo_mode(SiloMode.CONTROL):
            # New secondary email is created
            useremail = UserEmail.objects.create(
                user=user, email="ahmed@ahmed.io", is_verified=True
            )
            # Set secondary email to be primary
            user.email = useremail.email
            user.save()

            # Delete first email
            old_useremail = UserEmail.objects.get(email="foo@bar.dodo")
            old_useremail.delete()

        event_manager = EventManager({"message": "hello world", "level": "error"})
        event_manager.normalize()
        event_data = event_manager.get_data()
        event_type = get_event_type(event_data)
        event_data["type"] = event_type.key
        event_data["metadata"] = event_type.get_metadata(event_data)

        event = event_manager.save(self.project.id)

        with self.tasks():
            AlertRuleNotification(Notification(event=event), ActionTargetType.ISSUE_OWNERS).send()

        assert mock_func.call_count == 1

        args, kwargs = mock_func.call_args
        notification = args[1]

        user_ids = []
        for user in list(notification.get_participants().values())[0]:
            user_ids.append(user.id)
        assert "ahmed@ahmed.io" in get_email_addresses(user_ids, self.project).values()

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not len(UserOption.objects.filter(key="mail:email", value="foo@bar.dodo"))

    @mock_notify
    def test_multiline_error(self, mock_func):
        event_manager = EventManager({"message": "hello world\nfoo bar", "level": "error"})
        event_manager.normalize()
        event_data = event_manager.get_data()
        event_type = get_event_type(event_data)
        event_data["type"] = event_type.key
        event_data["metadata"] = event_type.get_metadata(event_data)

        # disable slack
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                provider="slack",
                type="alerts",
                value="never",
            )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        event = event_manager.save(self.project.id)
        with self.tasks():
            AlertRuleNotification(Notification(event=event), ActionTargetType.ISSUE_OWNERS).send()

        assert mock_func.call_count == 1
        args, kwargs = mock_func.call_args
        notification = args[1]
        assert notification.get_subject() == "BAR-1 - hello world"

    def test_notify_users_with_utf8_subject(self):
        event = self.store_event(
            data={"message": "רונית מגן", "level": "error"}, project_id=self.project.id
        )

        notification = Notification(event=event)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.subject == "[Sentry] BAR-1 - רונית מגן"

    def test_notify_users_with_their_timezones(self):
        """
        Test that ensures that datetime in issue alert email is in the user's timezone
        """
        from django.template.defaultfilters import date

        timestamp = datetime.now(tz=timezone.utc)
        local_timestamp_s = django_timezone.localtime(timestamp, pytz.timezone("Europe/Vienna"))
        local_timestamp = date(local_timestamp_s, "N j, Y, g:i:s a e")

        with assume_test_silo_mode(SiloMode.CONTROL):
            UserOption.objects.create(user=self.user, key="timezone", value="Europe/Vienna")

        event = self.store_event(
            data={"message": "foobar", "level": "error", "timestamp": iso_format(timestamp)},
            project_id=self.project.id,
        )

        notification = Notification(event=event)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        assert local_timestamp in str(msg.alternatives)

    def test_notify_with_suspect_commits(self):
        repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        release = self.create_release(project=self.project, version="v12")
        release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                }
            ]
        )

        event = self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=1)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": True,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "tags": {"sentry:release": release.version},
            },
            project_id=self.project.id,
        )
        assert event.group is not None
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        with self.tasks():
            notification = Notification(event=event)

            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]

        assert "Suspect Commits" in msg.body

    def test_notify_with_replay_id(self):
        project = self.project
        organization = project.organization
        event = self.store_event(
            data={
                "contexts": {"replay": {"replay_id": "46eb3948be25448abd53fe36b5891ff2"}},
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=1)),
                "tags": [("level", "error")],
                "request": {"url": "example.com"},
            },
            project_id=project.id,
        )
        assert event.group is not None
        event.group.substatus = GroupSubStatus.REGRESSED
        event.group.save()

        features = ["organizations:session-replay", "organizations:session-replay-issue-emails"]
        with self.feature(features):
            with self.tasks():
                notification = Notification(event=event)
                self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]

        expected_url = f"/organizations/{organization.slug}/issues/{event.group.id}/replays/?referrer=issue_alert-email"

        assert isinstance(msg, EmailMultiAlternatives)
        assert isinstance(msg.alternatives[0][0], str)
        assert expected_url in msg.alternatives[0][0]

    def test_slack_link(self):
        project = self.project
        organization = project.organization
        event = self.store_event(data=make_event_data("foo.jx"), project_id=project.id)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        with self.tasks():
            notification = Notification(event=event)
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]
        assert isinstance(msg, EmailMultiAlternatives)
        assert isinstance(msg.alternatives[0][0], str)
        assert (
            f"/settings/{organization.slug}/integrations/slack/?referrer=alert_email"
            in msg.alternatives[0][0]
        )
        assert "notification_uuid" in msg.body

    def test_slack_link_with_integration(self):
        project = self.project
        organization = project.organization
        event = self.store_event(data=make_event_data("foo.jx"), project_id=project.id)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(provider="msteams")
            integration.add_organization(organization)

        with self.tasks():
            notification = Notification(event=event)
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]
        assert isinstance(msg, EmailMultiAlternatives)
        assert isinstance(msg.alternatives[0][0], str)
        assert (
            f"/settings/{organization.slug}/integrations/slack/?referrer=alert_email"
            not in msg.alternatives[0][0]
        )
        assert "notification_uuid" in msg.body

    def test_slack_link_with_plugin(self):
        project = self.project
        organization = project.organization
        event = self.store_event(data=make_event_data("foo.jx"), project_id=project.id)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        OpsGeniePlugin().enable(project)

        with self.tasks():
            notification = Notification(event=event)
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]
        assert isinstance(msg, EmailMultiAlternatives)
        assert isinstance(msg.alternatives[0][0], str)
        assert (
            f"/settings/{organization.slug}/integrations/slack/?referrer=alert_email"
            not in msg.alternatives[0][0]
        )

    def test_notify_team_members(self):
        """Test that each member of a team is notified"""

        user = self.create_user(email="foo@example.com", is_active=True)
        user2 = self.create_user(email="baz@example.com", is_active=True)
        team = self.create_team(organization=self.organization, members=[user, user2])
        project = self.create_project(teams=[team])
        event = self.store_event(data=make_event_data("foo.py"), project_id=project.id)
        self.assert_notify(event, [user.email, user2.email], ActionTargetType.TEAM, str(team.id))

    def test_notify_user(self):
        user = self.create_user(email="foo@example.com", is_active=True)
        self.create_team(organization=self.organization, members=[user])
        event = self.store_event(data=make_event_data("foo.py"), project_id=self.project.id)
        self.assert_notify(event, [user.email], ActionTargetType.MEMBER, str(user.id))


@region_silo_test
class MailAdapterNotifyIssueOwnersTest(BaseMailAdapterTest):
    def create_assert_delete_projectownership(
        self,
        proj: Project,
        rules: Sequence[grammar.Rule],
        data: Mapping,
        asserted_emails_fired: Sequence[str],
    ):
        po = ProjectOwnership.objects.create(
            project_id=proj.id, schema=dump_schema(rules), fallthrough=False
        )
        self.assert_notify(
            self.store_event(data=data, project_id=proj.id),
            asserted_emails_fired,
        )
        po.delete()

    def test_notify_with_path(self):
        user = self.create_user(email="foo@example.com", is_active=True)
        user2 = self.create_user(email="baz@example.com", is_active=True)

        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(name="Test", teams=[team])
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(
                user_id=user.id, organization=organization
            ),
            team=team,
        )
        self.create_member(user=user2, organization=organization, teams=[team])
        self.group = self.create_group(
            first_seen=django_timezone.now(),
            last_seen=django_timezone.now(),
            project=project,
            message="hello  world",
            logger="root",
        )
        ProjectOwnership.objects.create(
            project_id=project.id,
            schema=dump_schema(
                [
                    grammar.Rule(Matcher("path", "*.py"), [Owner("team", team.slug)]),
                    grammar.Rule(Matcher("path", "*.jx"), [Owner("user", user2.email)]),
                    grammar.Rule(
                        Matcher("path", "*.cbl"),
                        [Owner("user", user.email), Owner("user", user2.email)],
                    ),
                ]
            ),
            fallthrough=True,
        )

        with self.feature("organizations:notification-all-recipients"):
            event_all_users = self.store_event(
                data=make_event_data("foo.cbl"), project_id=project.id
            )
            self.assert_notify(event_all_users, [user.email, user2.email])

        event_team = self.store_event(data=make_event_data("foo.py"), project_id=project.id)
        self.assert_notify(event_team, [user.email, user2.email])

        event_single_user = self.store_event(data=make_event_data("foo.jx"), project_id=project.id)
        self.assert_notify(event_single_user, [user2.email])

        with assume_test_silo_mode(SiloMode.CONTROL):
            # Make sure that disabling mail alerts works as expected
            NotificationSettingOption.objects.create(
                user_id=user2.id,
                scope_type="project",
                scope_identifier=project.id,
                type="alerts",
                value="never",
            )

        with self.feature("organizations:notification-all-recipients"):
            event_all_users = self.store_event(
                data=make_event_data("foo.cbl"), project_id=project.id
            )
            self.assert_notify(event_all_users, [user.email])

    def test_notify_with_release_tag(self):
        owner = self.create_user(email="theboss@example.com", is_active=True)
        organization = self.create_organization(owner=owner)
        team = self.create_team(organization=organization, name="awesome")
        team2 = self.create_team(organization=organization, name="sauce")
        project = self.create_project(name="Test", teams=[team, team2])

        user = self.create_user(email="foo@example.com", is_active=True)
        user2 = self.create_user(email="baz@example.com", is_active=True)

        user3 = self.create_user(email="one@example.com", is_active=True)
        user4 = self.create_user(email="two@example.com", is_active=True)
        user5 = self.create_user(email="three@example.com", is_active=True)

        [self.create_member(user=u, organization=organization, teams=[team]) for u in [user, user2]]
        [
            self.create_member(user=u, organization=organization, teams=[team2])
            for u in [user3, user4, user5]
        ]
        with assume_test_silo_mode(SiloMode.CONTROL):
            for u in [user, user2, user3, user4, user5]:
                # disable slack
                NotificationSettingProvider.objects.create(
                    user_id=u.id,
                    scope_type="user",
                    scope_identifier=u.id,
                    provider="slack",
                    type="alerts",
                    value="never",
                )
        with self.feature("organizations:notification-all-recipients"):
            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.release", "*"),
                        [Owner("user", user.email)],
                    ),
                    grammar.Rule(
                        Matcher("tags.release", "1"),
                        [Owner("user", user2.email)],
                    ),
                ],
                {"release": "1"},
                [user.email, user2.email],
            )

            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.release", "*"),
                        [Owner("user", user.email)],
                    ),
                    grammar.Rule(
                        Matcher("tags.release", "2"),
                        [Owner("team", team2.slug)],
                    ),
                ],
                {"release": "2"},
                [user.email, user3.email, user4.email, user5.email],
            )

    def test_notify_with_dist_tag(self):
        owner = self.create_user(email="theboss@example.com", is_active=True)
        organization = self.create_organization(owner=owner)
        team = self.create_team(organization=organization, name="awesome")
        team2 = self.create_team(organization=organization, name="sauce")
        project = self.create_project(name="Test", teams=[team, team2])

        user = self.create_user(email="foo@example.com", is_active=True)
        user2 = self.create_user(email="baz@example.com", is_active=True)

        user3 = self.create_user(email="one@example.com", is_active=True)
        user4 = self.create_user(email="two@example.com", is_active=True)
        user5 = self.create_user(email="three@example.com", is_active=True)

        [self.create_member(user=u, organization=organization, teams=[team]) for u in [user, user2]]
        [
            self.create_member(user=u, organization=organization, teams=[team2])
            for u in [user3, user4, user5]
        ]

        with assume_test_silo_mode(SiloMode.CONTROL):
            for u in [user, user2, user3, user4, user5]:
                NotificationSettingProvider.objects.create(
                    user_id=u.id,
                    scope_type="user",
                    scope_identifier=u.id,
                    provider="slack",
                    type="alerts",
                    value="never",
                )

        with self.feature("organizations:notification-all-recipients"):
            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.dist", "*"),
                        [Owner("user", user.email)],
                    ),
                    grammar.Rule(
                        Matcher("tags.dist", "rc1"),
                        [Owner("user", user2.email)],
                    ),
                ],
                {"dist": "rc1", "release": "1"},
                [user.email, user2.email],
            )

            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.dist", "*"),
                        [Owner("user", user.email)],
                    ),
                    grammar.Rule(
                        Matcher("tags.dist", "lenny"),
                        [Owner("team", team2.slug)],
                    ),
                ],
                {"dist": "lenny", "release": "1"},
                [user.email, user3.email, user4.email, user5.email],
            )

    def test_dont_notify_with_dist_if_no_rule(self):
        owner = self.create_user(email="theboss@example.com", is_active=True)
        organization = self.create_organization(owner=owner)
        team = self.create_team(organization=organization, name="awesome")
        project = self.create_project(name="Test", teams=[team])
        user = self.create_user(email="foo@example.com", is_active=True)
        self.create_member(user=user, organization=organization, teams=[team])

        with self.feature("organizations:notification-all-recipients"):
            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.abc", "hello"),
                        [Owner("user", user.email)],
                    ),
                ],
                {"dist": "hello", "release": "1"},
                [],
            )

    def test_notify_with_user_tag(self):
        owner = self.create_user(email="theboss@example.com", is_active=True)
        organization = self.create_organization(owner=owner)
        team = self.create_team(organization=organization, name="sentry")
        project = self.create_project(name="Test", teams=[team])

        user_by_id = self.create_user(email="one@example.com", is_active=True)
        user_by_username = self.create_user(email="two@example.com", is_active=True)
        user_by_email = self.create_user(email="three@example.com", is_active=True)
        user_by_ip = self.create_user(email="four@example.com", is_active=True)
        user_by_sub = self.create_user(email="five@example.com", is_active=True)
        user_by_extra = self.create_user(email="six@example.com", is_active=True)
        [
            self.create_member(user=u, organization=organization, teams=[team])
            for u in [
                user_by_id,
                user_by_username,
                user_by_email,
                user_by_ip,
                user_by_sub,
                user_by_extra,
            ]
        ]

        with self.feature("organizations:notification-all-recipients"):
            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.user.id", "unique_id"),
                        [Owner("user", user_by_id.email)],
                    ),
                    grammar.Rule(
                        Matcher("tags.user.username", "my_user"),
                        [Owner("user", user_by_username.email)],
                    ),
                    grammar.Rule(
                        Matcher("tags.user.email", "foo@example.com"),
                        [Owner("user", user_by_email.email)],
                    ),
                    grammar.Rule(
                        Matcher("tags.user.ip_address", "127.0.0.1"),
                        [Owner("user", user_by_ip.email)],
                    ),
                    grammar.Rule(
                        Matcher("tags.user.subscription", "basic"),
                        [Owner("user", user_by_sub.email)],
                    ),
                    grammar.Rule(
                        Matcher("tags.user.extra", "detail"),
                        [Owner("user", user_by_extra.email)],
                    ),
                ],
                {
                    "user": {
                        "id": "unique_id",
                        "username": "my_user",
                        "email": "foo@example.com",
                        "ip_address": "127.0.0.1",
                        "subscription": "basic",
                        "extra": "detail",
                    }
                },
                [
                    user_by_id.email,
                    user_by_username.email,
                    user_by_email.email,
                    user_by_ip.email,
                    user_by_sub.email,
                    user_by_extra.email,
                ],
            )

    def test_notify_with_user_tag_edge_cases(self):
        owner = self.create_user(email="theboss@example.com", is_active=True)
        organization = self.create_organization(owner=owner)
        team = self.create_team(organization=organization, name="sentry")
        project = self.create_project(name="Test", teams=[team])

        user = self.create_user(email="sentryuser@example.com", is_active=True)
        user_star = self.create_user(email="user_star@example.com", is_active=True)
        user_username = self.create_user(email="user_username@example.com", is_active=True)
        user_username_star = self.create_user(
            email="user_username_star@example.com", is_active=True
        )
        users = [user, user_star, user_username, user_username_star]
        for u in users:
            self.create_member(user=u, organization=organization, teams=[team])
        with assume_test_silo_mode(SiloMode.CONTROL):
            for u in users:
                NotificationSettingProvider.objects.create(
                    user_id=self.user.id,
                    scope_type="user",
                    scope_identifier=self.user.id,
                    provider="slack",
                    type="alerts",
                    value="never",
                )

        """
            tags.user.username:someemail@example.com sentryuser@example.com
            tags.user:someemail@example.com sentryuser@example.com

            tags.user:* sentryuser@example.com

            tags.user.username:* sentryuser@example.com
            tags.user:username sentryuser@example.com

            tags.user:*someemail* #sentry
        """
        with self.feature("organizations:notification-all-recipients"):
            dat = {"user": {"username": "someemail@example.com"}}
            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.user.username", "someemail@example.com"),
                        [Owner("user", user_username.email)],
                    )
                ],
                dat,
                [user_username.email],
            )

            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.user", "someemail@example.com"), [Owner("user", user.email)]
                    )
                ],
                dat,
                [],
            )

            self.create_assert_delete_projectownership(
                project,
                [grammar.Rule(Matcher("tags.user", "*"), [Owner("user", user_star.email)])],
                dat,
                [user_star.email],
            )

            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.user.username", "*"),
                        [Owner("user", user_username_star.email)],
                    )
                ],
                dat,
                [user_username_star.email],
            )

            self.create_assert_delete_projectownership(
                project,
                [grammar.Rule(Matcher("tags.user", "username"), [Owner("user", user.email)])],
                dat,
                [],
            )

            self.create_assert_delete_projectownership(
                project,
                [grammar.Rule(Matcher("tags.user", "*someemail*"), [Owner("team", team.slug)])],
                dat,
                [u.email for u in [user, user_star, user_username, user_username_star]],
            )

            self.create_assert_delete_projectownership(
                project,
                [
                    grammar.Rule(
                        Matcher("tags.user.email", "someemail*"), [Owner("team", team.slug)]
                    )
                ],
                {"user": {"username": "someemail@example.com"}},
                [],
            )

    @with_feature("organizations:escalating-issues")
    def test_group_substatus_header(self):
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        # Header is based on the group substatus
        assert event.group is not None
        event.group.substatus = GroupSubStatus.REGRESSED
        event.group.save()

        rule = Rule.objects.create(project=self.project, label="my rule")
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        assert msg.subject == "[Sentry] BAR-1 - Hello world"
        assert isinstance(msg.alternatives[0][0], str)
        assert "Regressed issue" in msg.alternatives[0][0]


@region_silo_test
class MailAdapterGetDigestSubjectTest(BaseMailAdapterTest):
    def test_get_digest_subject(self):
        assert (
            get_digest_subject(
                mock.Mock(qualified_short_id="BAR-1"),
                Counter({mock.sentinel.group: 3}),
                datetime(2016, 9, 19, 1, 2, 3, tzinfo=timezone.utc),
            )
            == "BAR-1 - 1 new alert since Sept. 19, 2016, 1:02 a.m. UTC"
        )


@region_silo_test
class MailAdapterNotifyDigestTest(BaseMailAdapterTest, ReplaysSnubaTestCase):
    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    def test_notify_digest(self, notify):
        project = self.project
        timestamp = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-2"]},
            project_id=project.id,
        )

        rule = project.rule_set.all()[0]
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        digest = build_digest(
            project, (event_to_record(event, (rule,)), event_to_record(event2, (rule,)))
        )[0]

        with self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.ISSUE_OWNERS)

        assert notify.call_count == 0
        assert len(mail.outbox) == 1

        message = mail.outbox[0]
        assert "List-ID" in message.message()
        assert isinstance(message, EmailMultiAlternatives)
        assert isinstance(message.alternatives[0][0], str)
        assert "notification_uuid" in message.alternatives[0][0]

    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    def test_notify_digest_replay_id(self, notify):
        project = self.project
        self.project.flags.has_replays = True
        self.project.save()

        timestamp = iso_format(before_now(minutes=1))
        replay1_id = "46eb3948be25448abd53fe36b5891ff2"
        event = self.store_event(
            data={
                "timestamp": timestamp,
                "fingerprint": ["group-1"],
                "contexts": {"replay": {"replay_id": replay1_id}},
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "timestamp": timestamp,
                "fingerprint": ["group-2"],
                "contexts": {"replay": {"replay_id": replay1_id}},
            },
            project_id=project.id,
        )

        self.store_replays(
            mock_replay(
                datetime.now() - timedelta(seconds=22),
                self.project.id,
                replay1_id,
            )
        )

        rule = project.rule_set.all()[0]
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        digest = build_digest(
            project, (event_to_record(event, (rule,)), event_to_record(event2, (rule,)))
        )[0]

        features = ["organizations:session-replay", "organizations:session-replay-issue-emails"]
        with self.feature(features), self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.ISSUE_OWNERS)

        assert notify.call_count == 0
        assert len(mail.outbox) == 1

        message = mail.outbox[0]
        assert "View Replays" in message.message().as_string()
        assert isinstance(message, EmailMultiAlternatives)
        assert isinstance(message.alternatives[0][0], str)
        assert "notification_uuid" in message.alternatives[0][0]

    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    def test_dont_notify_digest_snoozed(self, notify):
        """Test that a digest for an alert snoozed by user is not sent."""
        project = self.project
        timestamp = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-2"]},
            project_id=project.id,
        )

        rule = project.rule_set.all()[0]
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=rule)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        digest = build_digest(
            project, (event_to_record(event, (rule,)), event_to_record(event2, (rule,)))
        )[0]

        with self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.ISSUE_OWNERS)

        assert notify.call_count == 0
        assert len(mail.outbox) == 0

    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    def test_notify_digest_snooze_one_rule(self, notify):
        """Test that a digest is sent containing only notifications about an unsnoozed alert."""
        user2 = self.create_user(email="baz@example.com", is_active=True)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])
        project = self.project
        timestamp = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-2"]},
            project_id=project.id,
        )

        rule = project.rule_set.all()[0]
        rule2 = Rule.objects.create(project=project, label="my rule")
        # mute the first rule only for self.user, not user2
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=rule)

        ProjectOwnership.objects.create(project_id=project.id, fallthrough=True)
        digest = build_digest(
            project, (event_to_record(event, (rule,)), event_to_record(event2, (rule2,)))
        )[0]

        with self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.ISSUE_OWNERS)

        assert notify.call_count == 0
        assert len(mail.outbox) == 2  # we send it to 2 users
        messages = sorted(mail.outbox, key=lambda message: message.to[0])

        message1 = messages[0]
        message2 = messages[1]

        # self.user only receives a digest about one alert, since a rule was muted
        assert message1.to[0] == self.user.email
        assert "1 new alert since" in message1.subject

        # user2 receives a digest about both alerts, since no rules were muted
        assert message2.to[0] == user2.email
        assert "2 new alerts since" in message2.subject

    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    def test_dont_notify_digest_snoozed_multiple_rules(self, notify):
        """Test that a digest is only sent to the user who hasn't snoozed the rules."""
        user2 = self.create_user(email="baz@example.com", is_active=True)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])
        project = self.project
        timestamp = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-2"]},
            project_id=project.id,
        )

        rule = project.rule_set.all()[0]
        rule2 = Rule.objects.create(project=project, label="my rule")
        # mute the rules for self.user, not user2
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=rule)
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=rule2)

        ProjectOwnership.objects.create(project_id=project.id, fallthrough=True)
        digest = build_digest(
            project, (event_to_record(event, (rule,)), event_to_record(event2, (rule2,)))
        )[0]

        with self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.ISSUE_OWNERS)

        assert notify.call_count == 0
        assert len(mail.outbox) == 1  # we send it to only 1 user
        message = mail.outbox[0]

        # user2 receives a digest about both alerts, since no rules were muted
        assert message.to[0] == user2.email
        assert "2 new alerts since" in message.subject

    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    def test_dont_notify_digest_snoozed_multiple_rules_global_snooze(self, notify):
        """Test that a digest with only one rule is only sent to the user who didn't snooze one rule."""
        user2 = self.create_user(email="baz@example.com", is_active=True)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])
        project = self.project
        timestamp = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-2"]},
            project_id=project.id,
        )

        rule = project.rule_set.all()[0]
        rule2 = Rule.objects.create(project=project, label="my rule")
        # mute the first rule for self.user, not user2
        self.snooze_rule(user_id=self.user.id, owner_id=self.user.id, rule=rule)
        # mute the 2nd rule for both
        self.snooze_rule(owner_id=self.user.id, rule=rule2)

        ProjectOwnership.objects.create(project_id=project.id, fallthrough=True)
        digest = build_digest(
            project, (event_to_record(event, (rule,)), event_to_record(event2, (rule2,)))
        )[0]

        with self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.ISSUE_OWNERS)

        assert notify.call_count == 0
        assert len(mail.outbox) == 1  # we send it to only 1 user
        message = mail.outbox[0]

        # user2 receives a digest about only one alert
        assert message.to[0] == user2.email
        assert "1 new alert since" in message.subject

    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    @mock.patch.object(MessageBuilder, "send_async", autospec=True)
    def test_notify_digest_single_record(self, send_async, notify):
        event = self.store_event(data={}, project_id=self.project.id)
        rule = self.project.rule_set.all()[0]
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        digest = build_digest(self.project, (event_to_record(event, (rule,)),))[0]
        self.adapter.notify_digest(self.project, digest, ActionTargetType.ISSUE_OWNERS)
        assert send_async.call_count == 1
        assert notify.call_count == 1

    def test_notify_digest_subject_prefix(self):
        ProjectOption.objects.set_value(
            project=self.project, key="mail:subject_prefix", value="[Example prefix] "
        )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        timestamp = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )

        rule = self.project.rule_set.all()[0]

        digest = build_digest(
            self.project, (event_to_record(event, (rule,)), event_to_record(event2, (rule,)))
        )[0]

        with self.tasks():
            self.adapter.notify_digest(self.project, digest, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject.startswith("[Example prefix]")

    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    def test_notify_digest_user_does_not_exist(self, notify):
        """Test that in the event a rule has been created with an action to send to a user who
        no longer exists, we don't blow up when getting users in get_send_to
        """
        project = self.project
        timestamp = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"timestamp": timestamp, "fingerprint": ["group-2"]},
            project_id=project.id,
        )

        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(444),
        }
        rule = Rule.objects.create(
            project=self.project,
            label="a rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )

        digest = build_digest(
            project, (event_to_record(event, (rule,)), event_to_record(event2, (rule,)))
        )[0]

        with self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.MEMBER, 444)

        assert notify.call_count == 0
        assert len(mail.outbox) == 0


@region_silo_test
class MailAdapterRuleNotifyTest(BaseMailAdapterTest):
    @mock.patch("sentry.mail.adapter.logger")
    def test_normal(self, mock_logger):
        event = self.store_event(data={}, project_id=self.project.id)
        rule = Rule.objects.create(project=self.project, label="my rule")
        futures = [RuleFuture(rule, {})]
        with mock.patch.object(self.adapter, "notify") as notify:
            self.adapter.rule_notify(event, futures, ActionTargetType.ISSUE_OWNERS)
            assert notify.call_count == 1
            assert event.group
            mock_logger.info.assert_called_with(
                "mail.adapter.notification.%s",
                "dispatched",
                extra={
                    "event_id": event.event_id,
                    "group_id": event.group.id,
                    "is_from_mail_action_adapter": True,
                    "target_type": "IssueOwners",
                    "target_identifier": None,
                    "fallthrough_choice": None,
                    "notification_uuid": mock.ANY,
                    "rule_id": rule.id,
                    "project_id": event.group.project.id,
                },
            )

    @mock.patch("sentry.mail.adapter.digests")
    @mock.patch("sentry.mail.adapter.logger")
    def test_digest(self, mock_logger, digests):
        digests.enabled.return_value = True

        event = self.store_event(data={}, project_id=self.project.id)
        rule = self.create_project_rule(project=self.project)

        futures = [RuleFuture(rule, {})]
        self.adapter.rule_notify(event, futures, ActionTargetType.ISSUE_OWNERS)
        assert digests.add.call_count == 1
        assert event.group
        mock_logger.info.assert_called_with(
            "mail.adapter.notification.%s",
            "dispatched",
            extra={
                "event_id": event.event_id,
                "group_id": event.group.id,
                "is_from_mail_action_adapter": True,
                "target_type": "IssueOwners",
                "target_identifier": None,
                "fallthrough_choice": None,
                "notification_uuid": mock.ANY,
                "rule_id": rule.id,
                "project_id": event.group.project.id,
                "digest_key": mock.ANY,
            },
        )

    @mock.patch("sentry.mail.adapter.digests")
    def test_digest_with_perf_issue(self, digests):
        digests.enabled.return_value = True
        event = self.create_performance_issue()
        rule = self.create_project_rule(project=self.project)

        futures = [RuleFuture(rule, {})]
        self.adapter.rule_notify(event, futures, ActionTargetType.ISSUE_OWNERS)
        assert digests.add.call_count == 1

    def test_notify_includes_uuid(self):
        event = self.store_event(data={}, project_id=self.project.id)
        rule = Rule.objects.create(project=self.project, label="my rule")
        futures = [RuleFuture(rule, {})]
        notification_uuid = str(uuid.uuid4())
        with mock.patch.object(self.adapter, "notify") as notify:
            self.adapter.rule_notify(
                event, futures, ActionTargetType.ISSUE_OWNERS, notification_uuid=notification_uuid
            )
            notify.assert_called_once_with(
                mock.ANY, ActionTargetType.ISSUE_OWNERS, None, None, notification_uuid
            )


@region_silo_test
class MailAdapterNotifyAboutActivityTest(BaseMailAdapterTest):
    def test_assignment(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="workflow",
                value="always",
            )
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            user_id=self.create_user("foo@example.com").id,
            data={"assignee": str(self.user.id), "assigneeType": "user"},
        )

        with self.tasks():
            self.adapter.notify_about_activity(activity)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == "Re: [Sentry] BAR-1 - こんにちは"
        assert msg.to == [self.user.email]
        assert "notification_uuid" in msg.body

    def test_assignment_team(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="workflow",
                value="always",
            )
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            user_id=self.create_user("foo@example.com").id,
            data={"assignee": str(self.project.teams.first().id), "assigneeType": "team"},
        )

        with self.tasks():
            self.adapter.notify_about_activity(activity)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == "Re: [Sentry] BAR-1 - こんにちは"
        assert msg.to == [self.user.email]
        assert "notification_uuid" in msg.body

    def test_note(self):
        user_foo = self.create_user("foo@example.com")
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="workflow",
                value="always",
            )
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.NOTE.value,
            user_id=user_foo.id,
            data={"text": "sup guise"},
        )

        self.project.teams.first().organization.member_set.create(user_id=user_foo.id)

        with self.tasks():
            self.adapter.notify_about_activity(activity)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]

        assert msg.subject == "Re: [Sentry] BAR-1 - こんにちは"
        assert msg.to == [self.user.email]
        assert "notification_uuid" in msg.body


@region_silo_test
class MailAdapterHandleSignalTest(BaseMailAdapterTest):
    def create_report(self):
        user_foo = self.create_user("foo@example.com")
        self.project.teams.first().organization.member_set.create(user_id=user_foo.id)

        return UserReport.objects.create(
            project_id=self.project.id,
            group_id=self.group.id,
            name="Homer Simpson",
            email="homer.simpson@example.com",
        )

    def test_user_feedback(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="workflow",
                value="always",
            )
        report = self.create_report()
        with self.tasks():
            self.adapter.handle_user_report(
                project=self.project,
                report=serialize(report, AnonymousUser(), UserReportWithGroupSerializer()),
            )

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)

        # email includes issue metadata
        assert isinstance(msg.alternatives[0][0], str)
        assert "group-header" in msg.alternatives[0][0]
        assert "enhanced privacy" not in msg.body

        assert (
            msg.subject
            == f"[Sentry] {self.group.qualified_short_id} - New Feedback from Homer Simpson"
        )
        assert msg.to == [self.user.email]
        assert "notification_uuid" in msg.body

    def test_user_feedback__enhanced_privacy(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="workflow",
                value="always",
            )
        self.organization.update(flags=F("flags").bitor(Organization.flags.enhanced_privacy))
        assert self.organization.flags.enhanced_privacy.is_set is True
        report = self.create_report()

        with self.tasks():
            self.adapter.handle_user_report(
                project=self.project,
                report=serialize(report, AnonymousUser(), UserReportWithGroupSerializer()),
            )

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)

        # email does not include issue metadata
        assert isinstance(msg.alternatives[0][0], str)
        assert "group-header" not in msg.alternatives[0][0]
        assert "enhanced privacy" in msg.body

        assert (
            msg.subject
            == f"[Sentry] {self.group.qualified_short_id} - New Feedback from Homer Simpson"
        )
        assert msg.to == [self.user.email]
        assert "notification_uuid" in msg.body
