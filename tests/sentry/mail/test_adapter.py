from datetime import datetime

import pytz
from django.contrib.auth.models import AnonymousUser
from django.core import mail
from django.db.models import F
from django.utils import timezone
from exam import fixture

from sentry.api.serializers import serialize
from sentry.api.serializers.models.userreport import UserReportWithGroupSerializer
from sentry.digests.notifications import build_digest, event_to_record
from sentry.event_manager import EventManager, get_event_type
from sentry.mail import mail_adapter, send_notification_as_email
from sentry.mail.adapter import ActionTargetType
from sentry.models import (
    Activity,
    GroupRelease,
    Integration,
    NotificationSetting,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    ProjectOption,
    ProjectOwnership,
    Repository,
    Rule,
    User,
    UserOption,
    UserReport,
)
from sentry.notifications.rules import AlertRuleNotification
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.notifications.utils.participants import (
    get_send_to,
    get_send_to_member,
    get_send_to_owners,
    get_send_to_team,
)
from sentry.ownership import grammar
from sentry.ownership.grammar import Matcher, Owner, dump_schema
from sentry.plugins.base import Notification
from sentry.rules.processor import RuleFuture
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.types.integrations import ExternalProviders
from sentry.utils.compat import mock
from sentry.utils.email import MessageBuilder
from sentry_plugins.opsgenie.plugin import OpsGeniePlugin


def send_notification(*args):
    args_list = list(args)[1:]
    send_notification_as_email(*args_list, {})


class BaseMailAdapterTest:
    @fixture
    def adapter(self):
        return mail_adapter

    def make_event_data(self, filename, url="http://example.com"):
        mgr = EventManager(
            {
                "tags": [("level", "error")],
                "stacktrace": {"frames": [{"lineno": 1, "filename": filename}]},
                "request": {"url": url},
            }
        )
        mgr.normalize()
        data = mgr.get_data()
        event_type = get_event_type(data)
        data["type"] = event_type.key
        data["metadata"] = event_type.get_metadata(data)
        return data


class MailAdapterGetSendToTest(BaseMailAdapterTest, TestCase):
    def setUp(self):
        self.user2 = self.create_user(email="baz@example.com", is_active=True)
        self.create_member(user=self.user2, organization=self.organization, teams=[self.team])
        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema(
                [
                    grammar.Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)]),
                    grammar.Rule(Matcher("path", "*.jx"), [Owner("user", self.user2.email)]),
                    grammar.Rule(
                        Matcher("path", "*.cbl"),
                        [Owner("user", self.user.email), Owner("user", self.user2.email)],
                    ),
                ]
            ),
            fallthrough=True,
        )

    def test_get_send_to_with_team_owners(self):
        event = self.store_event(data=self.make_event_data("foo.py"), project_id=self.project.id)
        assert {self.user, self.user2} == get_send_to(
            self.project, ActionTargetType.ISSUE_OWNERS, event=event.data
        )[ExternalProviders.EMAIL]

        # Make sure that disabling mail alerts works as expected
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user2,
            project=self.project,
        )
        assert {self.user} == get_send_to(
            self.project, ActionTargetType.ISSUE_OWNERS, event=event.data
        )[ExternalProviders.EMAIL]

    def test_get_send_to_with_user_owners(self):
        event = self.store_event(data=self.make_event_data("foo.cbl"), project_id=self.project.id)
        assert {self.user, self.user2} == get_send_to(
            self.project, ActionTargetType.ISSUE_OWNERS, event=event.data
        )[ExternalProviders.EMAIL]

        # Make sure that disabling mail alerts works as expected
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user2,
            project=self.project,
        )
        assert {self.user} == get_send_to(
            self.project, ActionTargetType.ISSUE_OWNERS, event=event.data
        )[ExternalProviders.EMAIL]

    def test_get_send_to_with_user_owner(self):
        event = self.store_event(data=self.make_event_data("foo.jx"), project_id=self.project.id)
        assert {self.user2} == get_send_to(
            self.project, ActionTargetType.ISSUE_OWNERS, event=event.data
        )[ExternalProviders.EMAIL]

    def test_get_send_to_with_fallthrough(self):
        event = self.store_event(data=self.make_event_data("foo.cpp"), project_id=self.project.id)
        assert {self.user, self.user2} == get_send_to(
            self.project, ActionTargetType.ISSUE_OWNERS, event=event.data
        )[ExternalProviders.EMAIL]

    def test_get_send_to_without_fallthrough(self):
        ProjectOwnership.objects.get(project_id=self.project.id).update(fallthrough=False)
        event = self.store_event(data=self.make_event_data("foo.cpp"), project_id=self.project.id)
        assert set() == set(
            get_send_to(self.project, ActionTargetType.ISSUE_OWNERS, event=event.data)
        )


class MailAdapterGetSendableUsersTest(BaseMailAdapterTest, TestCase):
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
            organizationmember=OrganizationMember.objects.get(user=user, organization=organization),
            team=team,
        )
        self.create_member(user=user2, organization=organization, teams=[team])

        # all members
        users = self.adapter.get_sendable_user_objects(project)
        assert sorted({user.id, user2.id}) == sorted(user.id for user in users)

        # disabled user2
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user2,
            project=project,
        )

        assert user2 not in self.adapter.get_sendable_user_objects(project)

        user4 = User.objects.create(username="baz4", email="bar@example.com", is_active=True)
        self.create_member(user=user4, organization=organization, teams=[team])
        assert user4 in self.adapter.get_sendable_user_objects(project)

        # disabled by default user4
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user4,
        )

        assert user4 not in self.adapter.get_sendable_user_objects(project)

        NotificationSetting.objects.remove_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            user=user4,
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user4,
        )

        assert user4 not in self.adapter.get_sendable_user_objects(project)


class MailAdapterBuildSubjectPrefixTest(BaseMailAdapterTest, TestCase):
    def test_default_prefix(self):
        assert self.adapter._build_subject_prefix(self.project) == "[Sentry] "

    def test_project_level_prefix(self):
        prefix = "[Example prefix] "
        ProjectOption.objects.set_value(
            project=self.project, key="mail:subject_prefix", value=prefix
        )
        assert self.adapter._build_subject_prefix(self.project) == prefix


class MailAdapterBuildMessageTest(BaseMailAdapterTest, TestCase):
    def test(self):
        subject = "hello"
        assert self.adapter._build_message(self.project, subject) is None

    def test_specify_send_to(self):
        subject = "hello"
        send_to_user = self.create_user("hello@timecube.com")
        msg = self.adapter._build_message(self.project, subject, send_to=[send_to_user.id])
        assert msg._send_to == {send_to_user.email}
        assert msg.subject.endswith(subject)


class MailAdapterSendMailTest(BaseMailAdapterTest, TestCase):
    def test(self):
        subject = "hello"
        with self.tasks():
            self.adapter._send_mail(self.project, subject, body="hi", send_to=[self.user.id])
            msg = mail.outbox[0]
            assert msg.subject.endswith(subject)
            assert msg.recipients() == [self.user.email]


class MailAdapterNotifyTest(BaseMailAdapterTest, TestCase):
    def test_simple_notification(self):
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )

        rule = Rule.objects.create(project=self.project, label="my rule")

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        msg = mail.outbox[0]
        assert msg.subject == "[Sentry] BAR-1 - Hello world"
        assert "my rule" in msg.alternatives[0][0]

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

        with self.options({"system.url-prefix": "http://example.com"}):
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        _get_title.assert_called_once_with()
        _to_email_html.assert_called_once_with(event)

    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_notify_users_does_email(self, mock_func):
        UserOption.objects.create(user=self.user, key="timezone", value="Europe/Vienna")
        event_manager = EventManager({"message": "hello world", "level": "error"})
        event_manager.normalize()
        event_data = event_manager.get_data()
        event_type = get_event_type(event_data)
        event_data["type"] = event_type.key
        event_data["metadata"] = event_type.get_metadata(event_data)

        event = event_manager.save(self.project.id)
        group = event.group

        with self.tasks():
            AlertRuleNotification(Notification(event=event), ActionTargetType.ISSUE_OWNERS).send()

        assert mock_func.call_count == 1

        args, kwargs = mock_func.call_args
        notification = args[1]

        assert notification.get_user_context(self.user, {})["timezone"] == pytz.timezone(
            "Europe/Vienna"
        )

        self.assertEquals(notification.project, self.project)
        self.assertEquals(notification.get_reference(), group)
        assert notification.get_subject() == "BAR-1 - hello world"

    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_multiline_error(self, mock_func):
        event_manager = EventManager({"message": "hello world\nfoo bar", "level": "error"})
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
        assert notification.get_subject() == "BAR-1 - hello world"

    def test_notify_users_with_utf8_subject(self):
        event = self.store_event(
            data={"message": "רונית מגן", "level": "error"}, project_id=self.project.id
        )

        notification = Notification(event=event)

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

        timestamp = datetime.now(tz=pytz.utc)
        local_timestamp = timezone.localtime(timestamp, pytz.timezone("Europe/Vienna"))
        local_timestamp = date(local_timestamp, "N j, Y, g:i:s a e")

        UserOption.objects.create(user=self.user, key="timezone", value="Europe/Vienna")

        event = self.store_event(
            data={"message": "foobar", "level": "error", "timestamp": iso_format(timestamp)},
            project_id=self.project.id,
        )

        notification = Notification(event=event)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert local_timestamp in str(msg.alternatives)

    def test_notify_with_suspect_commits(self):
        repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
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
        GroupRelease.objects.create(
            group_id=event.group.id, project_id=self.project.id, release_id=self.release.id
        )

        with self.tasks():
            notification = Notification(event=event)

            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]

        assert "Suspect Commits" in msg.body

    def test_slack_link(self):
        project = self.project
        organization = project.organization
        event = self.store_event(data=self.make_event_data("foo.jx"), project_id=project.id)

        with self.tasks():
            notification = Notification(event=event)
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]
        assert (
            f"/settings/{organization.slug}/integrations/slack/?referrer=alert_email"
            in msg.alternatives[0][0]
        )

    def test_slack_link_with_integration(self):
        project = self.project
        organization = project.organization
        event = self.store_event(data=self.make_event_data("foo.jx"), project_id=project.id)

        integration = Integration.objects.create(provider="msteams")
        integration.add_organization(organization)

        with self.tasks():
            notification = Notification(event=event)
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]
        assert (
            f"/settings/{organization.slug}/integrations/slack/?referrer=alert_email"
            not in msg.alternatives[0][0]
        )

    def test_slack_link_with_plugin(self):
        project = self.project
        organization = project.organization
        event = self.store_event(data=self.make_event_data("foo.jx"), project_id=project.id)

        OpsGeniePlugin().enable(project)

        with self.tasks():
            notification = Notification(event=event)
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]
        assert (
            f"/settings/{organization.slug}/integrations/slack/?referrer=alert_email"
            not in msg.alternatives[0][0]
        )

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

    def test_notify_users_with_owners(self):
        user = self.create_user(email="foo@example.com", is_active=True)
        user2 = self.create_user(email="baz@example.com", is_active=True)

        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(name="Test", teams=[team])
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(user=user, organization=organization),
            team=team,
        )
        self.create_member(user=user2, organization=organization, teams=[team])
        self.group = self.create_group(
            first_seen=timezone.now(),
            last_seen=timezone.now(),
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

        event_all_users = self.store_event(
            data=self.make_event_data("foo.cbl"), project_id=project.id
        )
        self.assert_notify(event_all_users, [user.email, user2.email])

        event_team = self.store_event(data=self.make_event_data("foo.py"), project_id=project.id)
        self.assert_notify(event_team, [user.email, user2.email])

        event_single_user = self.store_event(
            data=self.make_event_data("foo.jx"), project_id=project.id
        )
        self.assert_notify(event_single_user, [user2.email])

        # Make sure that disabling mail alerts works as expected
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user2,
            project=project,
        )
        event_all_users = self.store_event(
            data=self.make_event_data("foo.cbl"), project_id=project.id
        )
        self.assert_notify(event_all_users, [user.email])

    def test_notify_team_members(self):
        """Test that each member of a team is notified"""

        user = self.create_user(email="foo@example.com", is_active=True)
        user2 = self.create_user(email="baz@example.com", is_active=True)
        team = self.create_team(organization=self.organization, members=[user, user2])
        project = self.create_project(teams=[team])
        event = self.store_event(data=self.make_event_data("foo.py"), project_id=project.id)
        self.assert_notify(event, [user.email, user2.email], ActionTargetType.TEAM, str(team.id))

    def test_notify_user(self):
        user = self.create_user(email="foo@example.com", is_active=True)
        self.create_team(organization=self.organization, members=[user])
        event = self.store_event(data=self.make_event_data("foo.py"), project_id=self.project.id)
        self.assert_notify(event, [user.email], ActionTargetType.MEMBER, str(user.id))


class MailAdapterGetDigestSubjectTest(BaseMailAdapterTest, TestCase):
    def test_get_digest_subject(self):
        assert (
            self.adapter.get_digest_subject(
                mock.Mock(qualified_short_id="BAR-1"),
                {mock.sentinel.group: 3},
                datetime(2016, 9, 19, 1, 2, 3, tzinfo=pytz.utc),
            )
            == "BAR-1 - 1 new alert since Sept. 19, 2016, 1:02 a.m. UTC"
        )


class MailAdapterNotifyDigestTest(BaseMailAdapterTest, TestCase):
    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    def test_notify_digest(self, notify):
        project = self.project
        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1)), "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1)), "fingerprint": ["group-2"]},
            project_id=project.id,
        )

        rule = project.rule_set.all()[0]
        digest = build_digest(
            project, (event_to_record(event, (rule,)), event_to_record(event2, (rule,)))
        )

        with self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.ISSUE_OWNERS)

        assert notify.call_count == 0
        assert len(mail.outbox) == 1

        message = mail.outbox[0]
        assert "List-ID" in message.message()

    @mock.patch.object(mail_adapter, "notify", side_effect=mail_adapter.notify, autospec=True)
    @mock.patch.object(MessageBuilder, "send_async", autospec=True)
    def test_notify_digest_single_record(self, send_async, notify):
        event = self.store_event(data={}, project_id=self.project.id)
        rule = self.project.rule_set.all()[0]
        digest = build_digest(self.project, (event_to_record(event, (rule,)),))
        self.adapter.notify_digest(self.project, digest, ActionTargetType.ISSUE_OWNERS)
        assert send_async.call_count == 1
        assert notify.call_count == 1

    def test_notify_digest_subject_prefix(self):
        ProjectOption.objects.set_value(
            project=self.project, key="mail:subject_prefix", value="[Example prefix] "
        )
        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1)), "fingerprint": ["group-2"]},
            project_id=self.project.id,
        )

        rule = self.project.rule_set.all()[0]

        digest = build_digest(
            self.project, (event_to_record(event, (rule,)), event_to_record(event2, (rule,)))
        )

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
        event = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1)), "fingerprint": ["group-1"]},
            project_id=project.id,
        )
        event2 = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1)), "fingerprint": ["group-2"]},
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
        )

        with self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.MEMBER, 444)

        assert notify.call_count == 0
        assert len(mail.outbox) == 0


class MailAdapterRuleNotifyTest(BaseMailAdapterTest, TestCase):
    def test_normal(self):
        event = self.store_event(data={}, project_id=self.project.id)
        rule = Rule.objects.create(project=self.project, label="my rule")
        futures = [RuleFuture(rule, {})]
        with mock.patch.object(self.adapter, "notify") as notify:
            self.adapter.rule_notify(event, futures, ActionTargetType.ISSUE_OWNERS)
            assert notify.call_count == 1

    @mock.patch("sentry.mail.adapter.digests")
    def test_digest(self, digests):
        digests.enabled.return_value = True

        event = self.store_event(data={}, project_id=self.project.id)
        rule = Rule.objects.create(project=self.project, label="my rule")

        futures = [RuleFuture(rule, {})]
        self.adapter.rule_notify(event, futures, ActionTargetType.ISSUE_OWNERS)
        assert digests.add.call_count == 1


class MailAdapterShouldNotifyTest(BaseMailAdapterTest, TestCase):
    def test_should_notify(self):
        assert self.adapter.should_notify(ActionTargetType.ISSUE_OWNERS, self.group)
        assert self.adapter.should_notify(ActionTargetType.MEMBER, self.group)

    def test_should_not_notify_no_users(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )
        assert not self.adapter.should_notify(ActionTargetType.ISSUE_OWNERS, self.group)

    def test_should_always_notify_target_member(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )
        assert self.adapter.should_notify(ActionTargetType.MEMBER, self.group)


class MailAdapterGetSendToOwnersTest(BaseMailAdapterTest, TestCase):
    def setUp(self):
        self.user = self.create_user(email="foo@example.com", is_active=True)
        self.user2 = self.create_user(email="baz@example.com", is_active=True)
        self.user3 = self.create_user(email="bar@example.com", is_active=True)

        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(
            organization=self.organization, members=[self.user2, self.user3]
        )
        self.team2 = self.create_team(organization=self.organization, members=[self.user])
        self.project = self.create_project(name="Test", teams=[self.team, self.team2])
        self.group = self.create_group(
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            project=self.project,
            message="hello  world",
            logger="root",
        )
        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema(
                [
                    grammar.Rule(Matcher("path", "*.py"), [Owner("team", self.team.slug)]),
                    grammar.Rule(Matcher("path", "*.jx"), [Owner("user", self.user2.email)]),
                    grammar.Rule(
                        Matcher("path", "*.cbl"),
                        [
                            Owner("user", self.user.email),
                            Owner("user", self.user2.email),
                            Owner("user", self.user3.email),
                        ],
                    ),
                ]
            ),
            fallthrough=True,
        )

    def test_all_users(self):
        event_all_users = self.store_event(
            data=self.make_event_data("foo.cbl"), project_id=self.project.id
        )
        assert get_send_to_owners(event_all_users, self.project)[ExternalProviders.EMAIL] == {
            self.user,
            self.user2,
            self.user3,
        }

    def test_team(self):
        event_team = self.store_event(
            data=self.make_event_data("foo.py"), project_id=self.project.id
        )
        assert get_send_to_owners(event_team, self.project)[ExternalProviders.EMAIL] == {
            self.user2,
            self.user3,
        }

    def test_single_user(self):
        event_single_user = self.store_event(
            data=self.make_event_data("foo.jx"), project_id=self.project.id
        )
        assert get_send_to_owners(event_single_user, self.project)[ExternalProviders.EMAIL] == {
            self.user2
        }

    def test_disable_alerts_user_scope(self):
        event_all_users = self.store_event(
            data=self.make_event_data("foo.cbl"), project_id=self.project.id
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user2,
        )

        assert (
            self.user2
            not in get_send_to_owners(event_all_users, self.project)[ExternalProviders.EMAIL]
        )

    def test_disable_alerts_project_scope(self):
        event_all_users = self.store_event(
            data=self.make_event_data("foo.cbl"), project_id=self.project.id
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user2,
            project=self.project,
        )

        assert (
            self.user2
            not in get_send_to_owners(event_all_users, self.project)[ExternalProviders.EMAIL]
        )

    def test_disable_alerts_multiple_scopes(self):
        event_all_users = self.store_event(
            data=self.make_event_data("foo.cbl"), project_id=self.project.id
        )

        # Project-independent setting.
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user2,
        )

        # Per-project setting.
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user2,
            project=self.project,
        )

        assert (
            self.user2
            not in get_send_to_owners(event_all_users, self.project)[ExternalProviders.EMAIL]
        )


class MailAdapterGetSendToTeamTest(BaseMailAdapterTest, TestCase):
    def test_send_to_team(self):
        assert {self.user} == get_send_to_team(self.project, str(self.team.id))[
            ExternalProviders.EMAIL
        ]

    def test_send_disabled(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )
        assert {} == get_send_to_team(self.project, str(self.team.id))

    def test_invalid_team(self):
        assert {} == get_send_to_team(self.project, "900001")

    def test_other_project_team(self):
        user_2 = self.create_user()
        team_2 = self.create_team(self.organization, members=[user_2])
        project_2 = self.create_project(organization=self.organization, teams=[team_2])
        assert {user_2} == get_send_to_team(project_2, str(team_2.id))[ExternalProviders.EMAIL]
        assert {} == get_send_to_team(self.project, str(team_2.id))

    def test_other_org_team(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        project_2 = self.create_project(organization=org_2, teams=[team_2])
        assert {user_2} == get_send_to_team(project_2, str(team_2.id))[ExternalProviders.EMAIL]
        assert {} == get_send_to_team(self.project, str(team_2.id))


class MailAdapterGetSendToMemberTest(BaseMailAdapterTest, TestCase):
    def test_send_to_user(self):
        assert {self.user} == get_send_to_member(self.project, str(self.user.id))[
            ExternalProviders.EMAIL
        ]

    def test_send_disabled_still_sends(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )
        assert {self.user} == get_send_to_member(self.project, str(self.user.id))[
            ExternalProviders.EMAIL
        ]

    def test_invalid_user(self):
        assert {} == get_send_to_member(self.project, "900001")

    def test_other_org_user(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        team_3 = self.create_team(org_2, members=[user_2])
        project_2 = self.create_project(organization=org_2, teams=[team_2, team_3])
        assert {user_2} == get_send_to_member(project_2, str(user_2.id))[ExternalProviders.EMAIL]
        assert {} == get_send_to_member(self.project, str(user_2.id))

    def test_no_project_access(self):
        org_2 = self.create_organization()
        user_2 = self.create_user()
        team_2 = self.create_team(org_2, members=[user_2])
        user_3 = self.create_user()
        self.create_team(org_2, members=[user_3])
        project_2 = self.create_project(organization=org_2, teams=[team_2])
        assert {user_2} == get_send_to_member(project_2, str(user_2.id))[ExternalProviders.EMAIL]
        assert {} == get_send_to_member(self.project, str(user_3.id))


class MailAdapterNotifyAboutActivityTest(BaseMailAdapterTest, TestCase):
    def test_assignment(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=Activity.ASSIGNED,
            user=self.create_user("foo@example.com"),
            data={"assignee": str(self.user.id), "assigneeType": "user"},
        )

        with self.tasks():
            self.adapter.notify_about_activity(activity)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == "Re: [Sentry] BAR-1 - こんにちは"
        assert msg.to == [self.user.email]

    def test_assignment_team(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=Activity.ASSIGNED,
            user=self.create_user("foo@example.com"),
            data={"assignee": str(self.project.teams.first().id), "assigneeType": "team"},
        )

        with self.tasks():
            self.adapter.notify_about_activity(activity)

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == "Re: [Sentry] BAR-1 - こんにちは"
        assert msg.to == [self.user.email]

    def test_note(self):
        user_foo = self.create_user("foo@example.com")
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=Activity.NOTE,
            user=user_foo,
            data={"text": "sup guise"},
        )

        self.project.teams.first().organization.member_set.create(user=user_foo)

        with self.tasks():
            self.adapter.notify_about_activity(activity)

        assert len(mail.outbox) >= 1

        msg = mail.outbox[-1]

        assert msg.subject == "Re: [Sentry] BAR-1 - こんにちは"
        assert msg.to == [self.user.email]


class MailAdapterHandleSignalTest(BaseMailAdapterTest, TestCase):
    def create_report(self):
        user_foo = self.create_user("foo@example.com")
        self.project.teams.first().organization.member_set.create(user=user_foo)

        return UserReport.objects.create(
            project_id=self.project.id,
            group_id=self.group.id,
            name="Homer Simpson",
            email="homer.simpson@example.com",
        )

    def test_user_feedback(self):
        report = self.create_report()
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )

        with self.tasks():
            self.adapter.handle_signal(
                name="user-reports.created",
                project=self.project,
                payload={
                    "report": serialize(report, AnonymousUser(), UserReportWithGroupSerializer())
                },
            )

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]

        # email includes issue metadata
        assert "group-header" in msg.alternatives[0][0]
        assert "enhanced privacy" not in msg.body

        assert (
            msg.subject
            == f"[Sentry] {self.group.qualified_short_id} - New Feedback from Homer Simpson"
        )
        assert msg.to == [self.user.email]

    def test_user_feedback__enhanced_privacy(self):
        self.organization.update(flags=F("flags").bitor(Organization.flags.enhanced_privacy))
        assert self.organization.flags.enhanced_privacy.is_set is True
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )

        report = self.create_report()

        with self.tasks():
            self.adapter.handle_signal(
                name="user-reports.created",
                project=self.project,
                payload={
                    "report": serialize(report, AnonymousUser(), UserReportWithGroupSerializer())
                },
            )

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]

        # email does not include issue metadata
        assert "group-header" not in msg.alternatives[0][0]
        assert "enhanced privacy" in msg.body

        assert (
            msg.subject
            == f"[Sentry] {self.group.qualified_short_id} - New Feedback from Homer Simpson"
        )
        assert msg.to == [self.user.email]
