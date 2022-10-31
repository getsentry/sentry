from unittest import mock
from unittest.mock import patch
from urllib.parse import parse_qs

import responses

import sentry
from sentry.constants import ObjectStatus
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.notifications import event_to_record
from sentry.models import (
    ExternalActor,
    Identity,
    IdentityProvider,
    IdentityStatus,
    NotificationSetting,
    OrganizationIntegration,
    ProjectOwnership,
    Rule,
)
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.types import (
    ActionTargetType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.ownership.grammar import Matcher, Owner
from sentry.ownership.grammar import Rule as GrammarRule
from sentry.ownership.grammar import dump_schema
from sentry.plugins.base import Notification
from sentry.tasks.digests import deliver_digest
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.testutils.silo import region_silo_test
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


@region_silo_test
class SlackIssueAlertNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_issue_alert_user(self, mock_func):
        """Test that issue alerts are sent to a Slack user."""

        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(self.user.id),
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule), ActionTargetType.MEMBER, self.user.id
        )

        with self.tasks():
            notification.send()

        attachment, text = get_attachment()

        assert attachment["title"] == "Hello world"
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/alerts/?referrer=issue_alert-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_performance_issue_alert_user(self, mock_func):
        """Test that performance issue alerts are sent to a Slack user."""

        event = self.create_performance_issue()

        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(self.user.id),
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule), ActionTargetType.MEMBER, self.user.id
        )
        with self.feature("organizations:performance-issues"), self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert attachment["title"] == "N+1 Query"
        assert (
            attachment["text"]
            == "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | production | <http://testserver/settings/account/notifications/alerts/?referrer=issue_alert-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_disabled_org_integration_for_user(self, mock_func):

        OrganizationIntegration.objects.filter(integration=self.integration).update(
            status=ObjectStatus.DISABLED
        )

        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(self.user.id),
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule), ActionTargetType.MEMBER, self.user.id
        )

        with self.tasks():
            notification.send()

        assert len(responses.calls) == 0

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_issue_alert_issue_owners(self, mock_func):
        """Test that issue alerts are sent to issue owners in Slack."""

        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "IssueOwners",
            "targetIdentifier": "",
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule), ActionTargetType.ISSUE_OWNERS, self.user.id
        )

        with self.tasks():
            notification.send()

        attachment, text = get_attachment()

        assert attachment["title"] == "Hello world"
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/alerts/?referrer=issue_alert-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_issue_alert_team_issue_owners(self, mock_func):
        """Test that issue alerts are sent to a team in Slack via an Issue Owners rule action."""

        # add a second user to the team so we can be sure it's only
        # sent once (to the team, and not to each individual user)
        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX2", config={})
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX2",
            idp=self.idp,
            user=user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user2,
        )
        # update the team's notification settings
        ExternalActor.objects.create(
            actor=self.team.actor,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            team=self.team,
        )

        rule = GrammarRule(Matcher("path", "*"), [Owner("team", self.team.slug)])
        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([rule]), fallthrough=True
        )

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "error",
                "stacktrace": {"frames": [{"filename": "foo.py"}]},
            },
            project_id=self.project.id,
        )

        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "IssueOwners",
            "targetIdentifier": "",
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule), ActionTargetType.ISSUE_OWNERS, self.team.id
        )

        with self.tasks():
            notification.send()

        # check that only one was sent out - more would mean each user is being notified
        # rather than the team
        assert len(responses.calls) == 1

        # check that the team got a notification
        data = parse_qs(responses.calls[0].request.body)
        assert data["channel"] == ["CXXXXXXX2"]
        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])
        assert len(attachments) == 1
        assert attachments[0]["title"] == "Hello world"
        assert (
            attachments[0]["footer"]
            == f"{self.project.slug} | <http://testserver/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=issue_alert-slack-team|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_disabled_org_integration_for_team(self, mock_func):

        # update the team's notification settings
        ExternalActor.objects.create(
            actor=self.team.actor,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            team=self.team,
        )

        OrganizationIntegration.objects.filter(integration=self.integration).update(
            status=ObjectStatus.DISABLED
        )

        rule = GrammarRule(Matcher("path", "*"), [Owner("team", self.team.slug)])
        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([rule]), fallthrough=True
        )

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "error",
                "stacktrace": {"frames": [{"filename": "foo.py"}]},
            },
            project_id=self.project.id,
        )

        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "IssueOwners",
            "targetIdentifier": "",
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule), ActionTargetType.ISSUE_OWNERS, self.team.id
        )

        with self.tasks():
            notification.send()

        # org integrationon disabled
        assert len(responses.calls) == 0

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    @patch.object(sentry, "digests")
    def test_issue_alert_team_issue_owners_user_settings_off_digests(self, digests, mock_func):
        """Test that issue alerts are sent to a team in Slack via an Issue Owners rule action
        even when the users' issue alert notification settings are off and digests are triggered."""

        backend = RedisBackend()
        digests.digest = backend.digest
        digests.enabled.return_value = True

        # turn off the user's issue alert notification settings
        # there was a bug where issue alerts to a team's Slack channel
        # were only firing if this was set to ALWAYS
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
        )
        # add a second user to the team so we can be sure it's only
        # sent once (to the team, and not to each individual user)
        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX2", config={})
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX2",
            idp=self.idp,
            user=user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.NEVER,
            user=user2,
        )
        # update the team's notification settings
        ExternalActor.objects.create(
            actor=self.team.actor,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            team=self.team,
        )

        rule = GrammarRule(Matcher("path", "*"), [Owner("team", self.team.slug)])
        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([rule]), fallthrough=True
        )

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "error",
                "stacktrace": {"frames": [{"filename": "foo.py"}]},
            },
            project_id=self.project.id,
        )

        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "IssueOwners",
            "targetIdentifier": "",
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )

        key = f"mail:p:{self.project.id}"
        backend.add(key, event_to_record(event, [rule]), increment_delay=0, maximum_delay=0)

        with self.tasks():
            deliver_digest(key)

        # check that only one was sent out - more would mean each user is being notified
        # rather than the team
        assert len(responses.calls) == 1

        # check that the team got a notification
        data = parse_qs(responses.calls[0].request.body)
        assert data["channel"] == ["CXXXXXXX2"]
        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])
        assert len(attachments) == 1
        assert attachments[0]["title"] == "Hello world"
        assert (
            attachments[0]["footer"]
            == f"{self.project.slug} | <http://testserver/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=issue_alert-slack-team|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_issue_alert_team(self, mock_func):
        """Test that issue alerts are sent to a team in Slack."""
        # add a second organization
        org = self.create_organization(owner=self.user)
        OrganizationIntegration.objects.create(organization=org, integration=self.integration)

        # add a second user to the team so we can be sure it's only
        # sent once (to the team, and not to each individual user)
        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX2", config={})
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX2",
            idp=self.idp,
            user=user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user2,
        )
        # update the team's notification settings
        ExternalActor.objects.create(
            actor=self.team.actor,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            team=self.team,
        )

        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Team",
            "targetIdentifier": str(self.team.id),
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )
        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.TEAM, self.team.id)

        # check that only one was sent out - more would mean each user is being notified
        # rather than the team
        assert len(responses.calls) == 1

        # check that the team got a notification
        data = parse_qs(responses.calls[0].request.body)
        assert data["channel"] == ["CXXXXXXX2"]
        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])
        assert len(attachments) == 1
        assert attachments[0]["title"] == "Hello world"
        assert (
            attachments[0]["footer"]
            == f"{self.project.slug} | <http://example.com/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=issue_alert-slack-team|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_issue_alert_team_new_project(self, mock_func):
        """Test that issue alerts are sent to a team in Slack when the team has added a new project"""

        # add a second user to the team so we can be sure it's only
        # sent once (to the team, and not to each individual user)
        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX2", config={})
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX2",
            idp=self.idp,
            user=user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user2,
        )
        # update the team's notification settings
        ExternalActor.objects.create(
            actor=self.team.actor,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            team=self.team,
        )
        # add a new project
        project2 = self.create_project(
            name="hellboy", organization=self.organization, teams=[self.team]
        )

        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=project2.id
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Team",
            "targetIdentifier": str(self.team.id),
        }
        rule = Rule.objects.create(
            project=project2,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )
        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.TEAM, self.team.id)

        # check that only one was sent out - more would mean each user is being notified
        # rather than the team
        assert len(responses.calls) == 1

        # check that the team got a notification
        data = parse_qs(responses.calls[0].request.body)
        assert data["channel"] == ["CXXXXXXX2"]
        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])
        assert len(attachments) == 1
        assert attachments[0]["title"] == "Hello world"
        assert (
            attachments[0]["footer"]
            == f"{project2.slug} | <http://example.com/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=issue_alert-slack-team|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_not_issue_alert_team_removed_project(self, mock_func):
        """Test that issue alerts are not sent to a team in Slack when the team has removed the project the issue belongs to"""

        # create the team's notification settings
        ExternalActor.objects.create(
            actor=self.team.actor,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            team=self.team,
        )
        # remove the project from the team
        self.project.remove_team(self.team)

        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Team",
            "targetIdentifier": str(self.team.id),
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )
        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.TEAM, self.team.id)

        assert len(responses.calls) == 0

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_issue_alert_team_fallback(self, mock_func):
        """Test that issue alerts are sent to each member of a team in Slack."""

        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX2",
            idp=self.idp,
            user=user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=user2,
        )

        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Team",
            "targetIdentifier": str(self.team.id),
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )
        notification = Notification(event=event, rule=rule)

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.adapter.notify(notification, ActionTargetType.TEAM, self.team.id)

        assert len(responses.calls) == 2

        # check that self.user got a notification
        call1 = parse_qs(responses.calls[0].request.body)
        call2 = parse_qs(responses.calls[1].request.body)

        # don't assume a particular order
        data = call1 if call1["channel"] == ["UXXXXXXX1"] else call2
        data2 = call2 if call2["channel"] == ["UXXXXXXX2"] else call1

        assert data["channel"] == ["UXXXXXXX1"]
        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])
        assert len(attachments) == 1
        assert attachments[0]["title"] == "Hello world"
        assert (
            attachments[0]["footer"]
            == f"{self.project.slug} | <http://example.com/settings/account/notifications/alerts/?referrer=issue_alert-slack-user|Notification Settings>"
        )

        # check that user2 got a notification as well
        assert data2["channel"] == ["UXXXXXXX2"]
        assert "attachments" in data2
        attachments = json.loads(data2["attachments"][0])
        assert len(attachments) == 1
        assert attachments[0]["title"] == "Hello world"
        assert (
            attachments[0]["footer"]
            == f"{self.project.slug} | <http://example.com/settings/account/notifications/alerts/?referrer=issue_alert-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    @patch.object(sentry, "digests")
    def test_digest_enabled(self, digests, mock_func):
        """
        Test that with digests enabled, but Slack notification settings
        (and not email settings), we send a Slack notification
        """
        backend = RedisBackend()
        digests.digest = backend.digest
        digests.enabled.return_value = True

        rule = Rule.objects.create(project=self.project, label="my rule")
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        key = f"mail:p:{self.project.id}"
        backend.add(key, event_to_record(event, [rule]), increment_delay=0, maximum_delay=0)

        with self.tasks():
            deliver_digest(key)

        attachment, text = get_attachment()

        assert attachment["title"] == "Hello world"
        assert attachment["text"] == ""
