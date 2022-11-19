from collections import Counter
from datetime import datetime, timedelta
from typing import Mapping, Sequence
from unittest import mock

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
from sentry.mail import build_subject_prefix, mail_adapter
from sentry.models import (
    Activity,
    Deploy,
    GroupRelease,
    Integration,
    NotificationSetting,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    ProjectOption,
    ProjectOwnership,
    Release,
    ReleaseActivity,
    Repository,
    Rule,
    User,
    UserEmail,
    UserOption,
    UserReport,
)
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.types import (
    ActionTargetType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.notifications.utils.digest import get_digest_subject
from sentry.ownership import grammar
from sentry.ownership.grammar import Matcher, Owner, dump_schema
from sentry.plugins.base import Notification
from sentry.rules import EventState
from sentry.testutils import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.types.issues import GroupType
from sentry.types.releaseactivity import ReleaseActivityType
from sentry.types.rules import RuleFuture
from sentry.utils.email import MessageBuilder, get_email_addresses
from sentry.utils.samples import load_data
from sentry_plugins.opsgenie.plugin import OpsGeniePlugin
from tests.sentry.mail import make_event_data, send_notification


class BaseMailAdapterTest(TestCase):
    @fixture
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


class MailAdapterActiveReleaseTest(BaseMailAdapterTest):
    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.notifications.utils.participants.get_release_committers")
    def test_simple(self, mock_get_release_committers, record):
        new_user = self.create_user(email="test@example.com", username="foo")
        new_team = self.create_team(name="Team Name", organization=self.organization)
        new_project = self.create_project(organization=self.organization, teams=[new_team])
        self.create_member(
            user=new_user, organization=self.organization, role="owner", teams=[new_team]
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ACTIVE_RELEASE,
            NotificationSettingOptionValues.ALWAYS,
            user=new_user,
            project=new_project,
        )
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=new_project.id
        )
        ProjectOwnership.objects.create(project=new_project, fallthrough=True)
        GroupOwner.objects.create(
            group_id=event.group.id,
            project=event.project,
            organization_id=self.organization.id,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user=new_user,
        )
        newRelease = Release.objects.create(
            organization_id=self.organization.id,
            project_id=new_project.id,
            version="2",
            date_added=timezone.now() - timedelta(days=1),
            date_released=None,
        )
        Deploy.objects.create(
            organization_id=self.organization.id,
            environment_id=self.environment.id,
            name="test_release_deployed",
            notified=True,
            release_id=newRelease.id,
            date_started=timezone.now() - timedelta(minutes=37),
            date_finished=timezone.now() - timedelta(minutes=20),
        )
        newRelease.add_project(new_project)

        event.data["tags"] = (("sentry:release", newRelease.version),)
        mock_get_release_committers.return_value = [new_user]

        mail.outbox = []
        with self.tasks(), self.feature("organizations:active-release-monitor-alpha"):
            self.adapter.notify_active_release(
                Notification(event=event),
                EventState(
                    is_new=True,
                    is_regression=False,
                    is_new_group_environment=False,
                    has_reappeared=False,
                ),
            )

        assert len(mail.outbox) == 1
        to_committer = mail.outbox[0]
        assert to_committer.subject == "**ARM** [Sentry] {} - Hello world".format(
            event.group.qualified_short_id
        )

        notification_record = [
            r for r in record.call_args_list if r[0][0] == "active_release_notification.sent"
        ]
        assert notification_record == [
            mock.call(
                "active_release_notification.sent",
                None,
                organization_id=self.organization.id,
                project_id=new_project.id,
                group_id=event.group.id,
                providers="email",
                release_version="2",
                recipient_email="test@example.com",
                recipient_username="foo",
                suspect_committer_ids=[f"user:{new_user.id}"],
                code_owner_ids=[new_user.id],
                team_ids=[new_team.id],
            )
        ]

        activity = list(ReleaseActivity.objects.filter(release_id=newRelease.id))
        assert len(activity) == 1
        assert activity[0].type == ReleaseActivityType.ISSUE.value
        assert activity[0].data["provider"] == EXTERNAL_PROVIDERS[ExternalProviders.EMAIL]
        assert activity[0].data["group_id"]


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

        # add a specific setting for a different provider
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
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


class MailAdapterBuildSubjectPrefixTest(BaseMailAdapterTest):
    def test_default_prefix(self):
        assert build_subject_prefix(self.project) == "[Sentry]"

    def test_project_level_prefix(self):
        prefix = "[Example prefix]"
        ProjectOption.objects.set_value(
            project=self.project, key="mail:subject_prefix", value=prefix
        )
        assert build_subject_prefix(self.project) == prefix


class MailAdapterNotifyTest(BaseMailAdapterTest):
    def test_simple_notification(self):
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )

        rule = Rule.objects.create(project=self.project, label="my rule")
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        msg = mail.outbox[0]
        assert msg.subject == "[Sentry] BAR-1 - Hello world"
        assert "my rule" in msg.alternatives[0][0]

    def test_simple_notification_perf(self):
        event_data = load_data(
            "transaction-n-plus-one",
            timestamp=before_now(minutes=10),
            fingerprint=[f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-group1"],
        )
        perf_event_manager = EventManager(event_data)
        perf_event_manager.normalize()
        with override_options(
            {
                "performance.issues.all.problem-creation": 1.0,
                "performance.issues.all.problem-detection": 1.0,
                "performance.issues.n_plus_one_db.problem-creation": 1.0,
            }
        ), self.feature(
            [
                "organizations:performance-issues-ingest",
                "projects:performance-suspect-spans-ingestion",
            ]
        ):
            event = perf_event_manager.save(self.project.id)
        event = event.for_group(event.groups[0])

        rule = Rule.objects.create(project=self.project, label="my rule")
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.ISSUE_OWNERS)

        msg = mail.outbox[0]
        assert msg.subject == "[Sentry] BAR-1 - N+1 Query"
        checked_values = [
            "Transaction Name",
            # TODO: Not sure if this is right
            "db - SELECT `books_author`.`id`, `books_author`.`",
            "Parent Span",
            "django.view - index",
            "Repeating Spans (10)",
            "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author`",
        ]
        for checked_value in checked_values:
            assert (
                checked_value in msg.alternatives[0][0]
            ), f"{checked_value} not present in message"

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

        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
        )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        with self.tasks():
            AlertRuleNotification(Notification(event=event), ActionTargetType.ISSUE_OWNERS).send()

        assert mock_func.call_count == 1

        args, kwargs = mock_func.call_args
        notification = args[1]

        assert notification.get_recipient_context(self.user, {})["timezone"] == pytz.timezone(
            "Europe/Vienna"
        )

        self.assertEqual(notification.project, self.project)
        self.assertEqual(notification.reference, group)
        assert notification.get_subject() == "BAR-1 - hello world"

    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
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

        UserOption.objects.create(
            user=user, key="mail:email", value="foo@bar.dodo", project=self.project
        )
        # disable slack
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user,
        )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        # New secondary email is created
        useremail = UserEmail.objects.create(user=user, email="ahmed@ahmed.io", is_verified=True)

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
        assert not len(UserOption.objects.filter(key="mail:email", value="foo@bar.dodo"))

    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_multiline_error(self, mock_func):
        event_manager = EventManager({"message": "hello world\nfoo bar", "level": "error"})
        event_manager.normalize()
        event_data = event_manager.get_data()
        event_type = get_event_type(event_data)
        event_data["type"] = event_type.key
        event_data["metadata"] = event_type.get_metadata(event_data)

        # disable slack
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
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

        timestamp = datetime.now(tz=pytz.utc)
        local_timestamp = timezone.localtime(timestamp, pytz.timezone("Europe/Vienna"))
        local_timestamp = date(local_timestamp, "N j, Y, g:i:s a e")

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
        event = self.store_event(data=make_event_data("foo.jx"), project_id=project.id)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

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
        event = self.store_event(data=make_event_data("foo.jx"), project_id=project.id)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

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
        event = self.store_event(data=make_event_data("foo.jx"), project_id=project.id)
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

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

        with self.feature("organizations:notification-all-recipients"):
            event_all_users = self.store_event(
                data=make_event_data("foo.cbl"), project_id=project.id
            )
            self.assert_notify(event_all_users, [user.email, user2.email])

        event_team = self.store_event(data=make_event_data("foo.py"), project_id=project.id)
        self.assert_notify(event_team, [user.email, user2.email])

        event_single_user = self.store_event(data=make_event_data("foo.jx"), project_id=project.id)
        self.assert_notify(event_single_user, [user2.email])

        # Make sure that disabling mail alerts works as expected
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user2,
            project=project,
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
        for u in [user, user2, user3, user4, user5]:
            # disable slack
            NotificationSetting.objects.update_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                NotificationSettingOptionValues.NEVER,
                user=u,
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

        for u in [user, user2, user3, user4, user5]:
            NotificationSetting.objects.update_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                NotificationSettingOptionValues.NEVER,
                user=u,
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
        [self.create_member(user=u, organization=organization, teams=[team]) for u in users]
        [
            NotificationSetting.objects.update_settings(
                ExternalProviders.SLACK,
                NotificationSettingTypes.ISSUE_ALERTS,
                NotificationSettingOptionValues.NEVER,
                user=u,
            )
            for u in users
        ]

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


class MailAdapterGetDigestSubjectTest(BaseMailAdapterTest):
    def test_get_digest_subject(self):
        assert (
            get_digest_subject(
                mock.Mock(qualified_short_id="BAR-1"),
                Counter({mock.sentinel.group: 3}),
                datetime(2016, 9, 19, 1, 2, 3, tzinfo=pytz.utc),
            )
            == "BAR-1 - 1 new alert since Sept. 19, 2016, 1:02 a.m. UTC"
        )


class MailAdapterNotifyDigestTest(BaseMailAdapterTest):
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
        )[0]

        with self.tasks():
            self.adapter.notify_digest(project, digest, ActionTargetType.MEMBER, 444)

        assert notify.call_count == 0
        assert len(mail.outbox) == 0


class MailAdapterRuleNotifyTest(BaseMailAdapterTest):
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

    @mock.patch("sentry.mail.adapter.digests")
    def test_digest_with_perf_issue(self, digests):
        digests.enabled.return_value = True
        event = self.store_event(
            data=load_data(
                "transaction",
                fingerprint=[f"{GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value}-group1"],
            ),
            project_id=self.project.id,
        )
        event = event.for_group(event.groups[0])
        rule = Rule.objects.create(project=self.project, label="my rule")

        futures = [RuleFuture(rule, {})]
        self.adapter.rule_notify(event, futures, ActionTargetType.ISSUE_OWNERS)
        assert digests.add.call_count == 1


class MailAdapterNotifyAboutActivityTest(BaseMailAdapterTest):
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
            type=ActivityType.ASSIGNED.value,
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
            type=ActivityType.ASSIGNED.value,
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
            type=ActivityType.NOTE.value,
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


class MailAdapterHandleSignalTest(BaseMailAdapterTest):
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
            self.adapter.handle_user_report(
                project=self.project,
                report=serialize(report, AnonymousUser(), UserReportWithGroupSerializer()),
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
            self.adapter.handle_user_report(
                project=self.project,
                report=serialize(report, AnonymousUser(), UserReportWithGroupSerializer()),
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
