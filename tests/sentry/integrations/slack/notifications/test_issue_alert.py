from unittest import mock
from unittest.mock import patch
from urllib.parse import parse_qs

import responses

import sentry
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.notifications import event_to_record
from sentry.models import (
    ExternalActor,
    Identity,
    IdentityProvider,
    IdentityStatus,
    NotificationSetting,
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
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


class SlackUnassignedNotificationTest(SlackActivityNotificationTest):
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
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/alerts/?referrer=AlertRuleSlackUser|Notification Settings>"
        )

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

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule), ActionTargetType.ISSUE_OWNERS, self.user.id
        )

        with self.tasks():
            notification.send()

        attachment, text = get_attachment()

        assert attachment["title"] == "Hello world"
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/alerts/?referrer=AlertRuleSlackUser|Notification Settings>"
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
            == f"{self.project.slug} | <http://testserver/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=AlertRuleSlackTeam|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_issue_alert_team_issue_owners_user_settings_off(self, mock_func):
        """Test that issue alerts are sent to a team in Slack via an Issue Owners rule action
        even when the users' issue alert notification settings are off."""

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
            == f"{self.project.slug} | <http://testserver/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=AlertRuleSlackTeam|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_issue_alert_team(self, mock_func):
        """Test that issue alerts are sent to a team in Slack."""

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
            == f"{self.project.slug} | <http://example.com/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=AlertRuleSlackTeam|Notification Settings>"
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
            == f"{project2.slug} | <http://example.com/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=AlertRuleSlackTeam|Notification Settings>"
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
        data = parse_qs(responses.calls[0].request.body)
        assert data["channel"] == ["UXXXXXXX1"]
        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])
        assert len(attachments) == 1
        assert attachments[0]["title"] == "Hello world"
        assert (
            attachments[0]["footer"]
            == f"{self.project.slug} | <http://example.com/settings/account/notifications/alerts/?referrer=AlertRuleSlackUser|Notification Settings>"
        )

        # check that user2 got a notification as well
        data2 = parse_qs(responses.calls[1].request.body)
        assert data2["channel"] == ["UXXXXXXX2"]
        assert "attachments" in data2
        attachments = json.loads(data2["attachments"][0])
        assert len(attachments) == 1
        assert attachments[0]["title"] == "Hello world"
        assert (
            attachments[0]["footer"]
            == f"{self.project.slug} | <http://example.com/settings/account/notifications/alerts/?referrer=AlertRuleSlackUser|Notification Settings>"
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
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        key = f"mail:p:{self.project.id}"
        backend.add(key, event_to_record(event, [rule]), increment_delay=0, maximum_delay=0)

        with self.tasks():
            deliver_digest(key)

        assert digests.call_count == 0

        attachment, text = get_attachment()

        assert attachment["title"] == "Hello world"
        assert attachment["text"] == ""
