import uuid
from datetime import UTC, datetime
from unittest import mock
from unittest.mock import patch

import orjson
import responses

import sentry
from sentry.constants import ObjectStatus
from sentry.digests.backends.redis import RedisBackend
from sentry.digests.notifications import event_to_record
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.slack.message_builder.issues import get_tags
from sentry.integrations.types import ExternalProviders
from sentry.issues.grouptype import MonitorIncidentType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.models.projectownership import ProjectOwnership
from sentry.models.rule import Rule
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType, FineTuningAPIKey
from sentry.ownership.grammar import Matcher, Owner
from sentry.ownership.grammar import Rule as GrammarRule
from sentry.ownership.grammar import dump_schema
from sentry.plugins.base import Notification
from sentry.silo.base import SiloMode
from sentry.tasks.digests import deliver_digest
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE, TEST_PERF_ISSUE_OCCURRENCE
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.users.models.identity import Identity, IdentityStatus

pytestmark = [requires_snuba]


old_get_tags = get_tags


def fake_get_tags(event_for_tags, tags):
    return old_get_tags(event_for_tags, None)


class SlackIssueAlertNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    def setUp(self):
        super().setUp()
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(self.user.id),
        }
        self.rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )

    def test_issue_alert_user_block(self):
        """
        Test that issues alert are sent to a Slack user with the proper payload when block kit is
        enabled.
        """
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        notification_uuid = str(uuid.uuid4())
        notification = AlertRuleNotification(
            Notification(event=event, rule=self.rule),
            ActionTargetType.MEMBER,
            self.user.id,
            notification_uuid=notification_uuid,
        )

        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        assert (
            fallback_text
            == f"Alert triggered <http://testserver/organizations/{event.organization.slug}/alerts/rules/{event.project.slug}/{self.rule.id}/details/|ja rule>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        assert event.group
        assert (
            blocks[1]["text"]["text"]
            == f":red_circle: <http://testserver/organizations/{event.organization.slug}/issues/{event.group.id}/?referrer=issue_alert-slack&notification_uuid={notification_uuid}&alert_rule_id={self.rule.id}&alert_type=issue|*Hello world*>"
        )
        assert (
            blocks[4]["elements"][0]["text"]
            == f"{event.project.slug} | <http://testserver/settings/account/notifications/alerts/?referrer=issue_alert-slack-user&notification_uuid={notification_uuid}&organizationId={event.organization.id}|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.integrations.slack.message_builder.issues.get_tags", new=fake_get_tags)
    @mock.patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_PERF_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_performance_issue_alert_user_block(self, occurrence):
        """
        Test that performance issue alerts are sent to a Slack user with the proper payload when
        block kit is enabled.
        """

        event = self.create_performance_issue()
        # this is a PerformanceNPlusOneGroupType event
        notification = AlertRuleNotification(
            Notification(event=event, rule=self.rule), ActionTargetType.MEMBER, self.user.id
        )
        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        assert (
            fallback_text
            == f"Alert triggered <http://testserver/organizations/{event.organization.slug}/alerts/rules/{event.project.slug}/{self.rule.id}/details/|ja rule>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        self.assert_performance_issue_blocks_with_culprit_blocks(
            blocks,
            event.organization,
            event.project.slug,
            event.group,
            "issue_alert-slack",
            alert_type=FineTuningAPIKey.ALERTS,
            issue_link_extra_params=f"&alert_rule_id={self.rule.id}&alert_type=issue",
        )

    @mock.patch("sentry.integrations.slack.message_builder.issues.get_tags", new=fake_get_tags)
    @responses.activate
    def test_crons_issue_alert_user_block(self):
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
            MonitorIncidentType,
            datetime.now(UTC),
            "info",
            "/api/123",
        )
        occurrence.save()
        event.occurrence = occurrence

        event.group.type = MonitorIncidentType.type_id
        notification = AlertRuleNotification(
            Notification(event=event, rule=self.rule), ActionTargetType.MEMBER, self.user.id
        )
        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        assert (
            fallback_text
            == f"Alert triggered <http://testserver/organizations/{event.organization.slug}/alerts/rules/{event.project.slug}/{self.rule.id}/details/|ja rule>"
        )
        assert len(blocks) == 5

    @patch(
        "sentry.eventstore.models.GroupEvent.occurrence",
        return_value=TEST_ISSUE_OCCURRENCE,
        new_callable=mock.PropertyMock,
    )
    def test_generic_issue_alert_user_block(self, occurrence):
        """
        Test that generic issue alerts are sent to a Slack user with the proper payload when
        block kit is enabled.
        """
        event = self.store_event(
            data={"message": "Hellboy's world", "level": "error"}, project_id=self.project.id
        )
        group_event = event.for_group(event.groups[0])

        notification = AlertRuleNotification(
            Notification(event=group_event, rule=self.rule), ActionTargetType.MEMBER, self.user.id
        )
        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        assert (
            fallback_text
            == f"Alert triggered <http://testserver/organizations/{event.organization.slug}/alerts/rules/{event.project.slug}/{self.rule.id}/details/|ja rule>"
        )
        assert blocks[0]["text"]["text"] == fallback_text

        self.assert_generic_issue_blocks(
            blocks,
            group_event.organization,
            event.project.slug,
            event.group,
            "issue_alert-slack",
            alert_type="alerts",
            issue_link_extra_params=f"&alert_rule_id={self.rule.id}&alert_type=issue",
        )

    def test_disabled_org_integration_for_user(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrganizationIntegration.objects.get(integration=self.integration).update(
                status=ObjectStatus.DISABLED
            )

        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )

        notification = AlertRuleNotification(
            Notification(event=event, rule=self.rule), ActionTargetType.MEMBER, self.user.id
        )

        with self.tasks():
            notification.send()

        assert not self.mock_post.called

    def test_issue_alert_issue_owners_block(self):
        """
        Test that issue alerts are sent to issue owners in Slack with the proper payload when block
        kit is enabled.
        """

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
        ProjectOwnership.objects.create(project_id=self.project.id)

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule),
            ActionTargetType.ISSUE_OWNERS,
            self.user.id,
            FallthroughChoiceType.ACTIVE_MEMBERS,
        )

        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        notification_uuid = notification.notification_uuid
        assert (
            fallback_text
            == f"Alert triggered <http://testserver/organizations/{event.organization.slug}/alerts/rules/{event.project.slug}/{rule.id}/details/|ja rule>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        assert event.group
        assert (
            blocks[1]["text"]["text"]
            == f":red_circle: <http://testserver/organizations/{event.organization.slug}/issues/{event.group.id}/?referrer=issue_alert-slack&notification_uuid={notification_uuid}&alert_rule_id={rule.id}&alert_type=issue|*Hello world*>"
        )
        assert (
            blocks[4]["elements"][0]["text"]
            == f"{event.project.slug} | <http://testserver/settings/account/notifications/alerts/?referrer=issue_alert-slack-user&notification_uuid={notification_uuid}&organizationId={event.organization.id}|Notification Settings>"
        )

    def test_issue_alert_issue_owners_environment_block(self):
        """
        Test that issue alerts are sent to issue owners in Slack with the environment in the query
        params when the alert rule filters by environment and block kit is enabled.
        """

        environment = self.create_environment(self.project, name="production")
        event = self.store_event(
            data={"message": "Hello world", "level": "error", "environment": environment.name},
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
        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            name="ja rule",
            environment_id=environment.id,
        )
        ProjectOwnership.objects.create(project_id=self.project.id)

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule),
            ActionTargetType.ISSUE_OWNERS,
            self.user.id,
            FallthroughChoiceType.ACTIVE_MEMBERS,
        )

        with self.tasks():
            notification.send()

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        notification_uuid = notification.notification_uuid
        assert (
            fallback_text
            == f"Alert triggered <http://testserver/organizations/{event.organization.slug}/alerts/rules/{event.project.slug}/{rule.id}/details/|ja rule>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        assert event.group
        assert (
            blocks[1]["text"]["text"]
            == f":red_circle: <http://testserver/organizations/{event.organization.slug}/issues/{event.group.id}/?referrer=issue_alert-slack&notification_uuid={notification_uuid}&environment={environment.name}&alert_rule_id={rule.id}&alert_type=issue|*Hello world*>"
        )
        assert (
            blocks[4]["elements"][0]["text"]
            == f"{event.project.slug} | {environment.name} | <http://testserver/settings/account/notifications/alerts/?referrer=issue_alert-slack-user&notification_uuid={notification_uuid}&organizationId={event.organization.id}|Notification Settings>"
        )

    @responses.activate
    def test_issue_alert_team_issue_owners_block(self):
        """
        Test that issue alerts are sent to a team in Slack via an Issue Owners rule action with the
        proper payload when block kit is enabled.
        """

        # add a second user to the team so we can be sure it's only
        # sent once (to the team, and not to each individual user)
        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX2")
            self.identity = Identity.objects.create(
                external_id="UXXXXXXX2",
                idp=self.idp,
                user=user2,
                status=IdentityStatus.VALID,
                scopes=[],
            )
        # update the team's notification settings
        ExternalActor.objects.create(
            team_id=self.team.id,
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            # provider is disabled by default
            NotificationSettingProvider.objects.create(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="alerts",
                value="always",
            )

        g_rule = GrammarRule(Matcher("path", "*"), [Owner("team", self.team.slug)])
        ProjectOwnership.objects.create(project_id=self.project.id, schema=dump_schema([g_rule]))

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
        assert self.mock_post.call_count == 1

        # check that the team got a notification
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        channel = self.mock_post.call_args.kwargs["channel"]
        assert channel == "CXXXXXXX2"
        notification_uuid = notification.notification_uuid

        assert (
            fallback_text
            == f"Alert triggered <http://testserver/organizations/{event.organization.slug}/alerts/rules/{event.project.slug}/{rule.id}/details/|ja rule>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        assert event.group
        assert (
            blocks[1]["text"]["text"]
            == f":red_circle: <http://testserver/organizations/{event.organization.slug}/issues/{event.group.id}/?referrer=issue_alert-slack&notification_uuid={notification_uuid}&alert_rule_id={rule.id}&alert_type=issue|*Hello world*>"
        )
        assert blocks[6]["elements"][0]["text"] == f"Suggested Assignees: #{self.team.slug}"
        assert (
            blocks[7]["elements"][0]["text"]
            == f"{event.project.slug} | <http://testserver/settings/{event.organization.slug}/teams/{self.team.slug}/notifications/?referrer=issue_alert-slack-team&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    def test_disabled_org_integration_for_team(self):
        # update the team's notification settings
        ExternalActor.objects.create(
            team_id=self.team.id,
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            OrganizationIntegration.objects.get(integration=self.integration).update(
                status=ObjectStatus.DISABLED
            )

        grammar_rule = GrammarRule(Matcher("path", "*"), [Owner("team", self.team.slug)])
        ProjectOwnership.objects.create(
            project_id=self.project.id, schema=dump_schema([grammar_rule])
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
        assert self.mock_post.call_count == 0

    @patch.object(sentry, "digests")
    def test_issue_alert_team_issue_owners_user_settings_off_digests(self, digests):
        """Test that issue alerts are sent to a team in Slack via an Issue Owners rule action
        even when the users' issue alert notification settings are off and digests are triggered."""

        backend = RedisBackend()
        digests.backend.digest = backend.digest
        digests.enabled.return_value = True

        # turn off the user's issue alert notification settings
        # there was a bug where issue alerts to a team's Slack channel
        # were only firing if this was set to ALWAYS
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="alerts",
                value="never",
            )
        # add a second user to the team so we can be sure it's only
        # sent once (to the team, and not to each individual user)
        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX2")
            self.identity = Identity.objects.create(
                external_id="UXXXXXXX2",
                idp=self.idp,
                user=user2,
                status=IdentityStatus.VALID,
                scopes=[],
            )
        # update the team's notification settings
        ExternalActor.objects.create(
            team_id=self.team.id,
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="alerts",
                value="always",
            )

        g_rule = GrammarRule(Matcher("path", "*"), [Owner("team", self.team.slug)])
        ProjectOwnership.objects.create(project_id=self.project.id, schema=dump_schema([g_rule]))

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

        # check that the team got a notification
        assert self.mock_post.call_args.kwargs["channel"] == "CXXXXXXX2"
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])

        assert "Hello world" in blocks[1]["text"]["text"]
        title_link = blocks[1]["text"]["text"][13:][1:-1]
        notification_uuid = self.get_notification_uuid(title_link)
        assert (
            blocks[-2]["elements"][0]["text"]
            == f"{self.project.slug} | <http://testserver/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=issue_alert-slack-team&notification_uuid={notification_uuid}|Notification Settings>"
        )

    def test_issue_alert_team_block(self):
        """Test that issue alerts are sent to a team in Slack when block kit is enabled."""
        # add a second organization
        org = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_organization_integration(
                organization_id=org.id, integration=self.integration
            )

        # add a second user to the team so we can be sure it's only
        # sent once (to the team, and not to each individual user)
        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX2")
            self.identity = Identity.objects.create(
                external_id="UXXXXXXX2",
                idp=self.idp,
                user=user2,
                status=IdentityStatus.VALID,
                scopes=[],
            )
        # update the team's notification settings
        ExternalActor.objects.create(
            team_id=self.team.id,
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="alerts",
                value="always",
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
        assert self.mock_post.call_count == 1

        # check that the team got a notification
        assert self.mock_post.call_args.kwargs["channel"] == "CXXXXXXX2"
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]

        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])

        assert (
            fallback_text
            == f"Alert triggered <http://example.com/organizations/{event.organization.slug}/alerts/rules/{event.project.slug}/{rule.id}/details/|ja rule>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        assert event.group
        assert (
            blocks[1]["text"]["text"]
            == f":red_circle: <http://example.com/organizations/{event.organization.slug}/issues/{event.group.id}/?referrer=issue_alert-slack&notification_uuid={notification_uuid}&alert_rule_id={rule.id}&alert_type=issue|*Hello world*>"
        )
        assert (
            blocks[5]["elements"][0]["text"]
            == f"{event.project.slug} | <http://example.com/settings/{event.organization.slug}/teams/{self.team.slug}/notifications/?referrer=issue_alert-slack-team&notification_uuid={notification_uuid}|Notification Settings>"
        )

    def test_issue_alert_team_new_project(self):
        """Test that issue alerts are sent to a team in Slack when the team has added a new project"""

        # add a second user to the team so we can be sure it's only
        # sent once (to the team, and not to each individual user)
        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX2")
            self.identity = Identity.objects.create(
                external_id="UXXXXXXX2",
                idp=self.idp,
                user=user2,
                status=IdentityStatus.VALID,
                scopes=[],
            )
        # update the team's notification settings
        ExternalActor.objects.create(
            team_id=self.team.id,
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="alerts",
                value="always",
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
        assert self.mock_post.call_count == 1

        # check that the team got a notification

        assert self.mock_post.call_args.kwargs["channel"] == "CXXXXXXX2"
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        assert "Hello world" in blocks[1]["text"]["text"]
        title_link = blocks[1]["text"]["text"][13:][1:-1]
        notification_uuid = self.get_notification_uuid(title_link)
        assert (
            blocks[-2]["elements"][0]["text"]
            == f"{project2.slug} | <http://example.com/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/?referrer=issue_alert-slack-team&notification_uuid={notification_uuid}|Notification Settings>"
        )

    def test_not_issue_alert_team_removed_project(self):
        """Test that issue alerts are not sent to a team in Slack when the team has removed the project the issue belongs to"""

        # create the team's notification settings
        ExternalActor.objects.create(
            team_id=self.team.id,
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="goma",
            external_id="CXXXXXXX2",
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.create(
                team_id=self.team.id,
                scope_type="team",
                scope_identifier=self.team.id,
                provider="slack",
                type="alerts",
                value="always",
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

        assert self.mock_post.call_count == 0

    def test_issue_alert_team_fallback(self):
        """Test that issue alerts are sent to each member of a team in Slack."""

        user2 = self.create_user(is_superuser=False)
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.identity = Identity.objects.create(
                external_id="UXXXXXXX2",
                idp=self.idp,
                user=user2,
                status=IdentityStatus.VALID,
                scopes=[],
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

        assert self.mock_post.call_count == 2

        # check that self.user got a notification
        call1 = self.mock_post.call_args_list[0].kwargs
        call2 = self.mock_post.call_args_list[1].kwargs

        # don't assume a particular order
        data = call1 if call1["channel"] == "UXXXXXXX1" else call2
        data2 = call2 if call2["channel"] == "UXXXXXXX2" else call1

        assert data["channel"] == "UXXXXXXX1"
        blocks = orjson.loads(data["blocks"])
        assert "Hello world" in blocks[1]["text"]["text"]
        title_link = blocks[1]["text"]["text"]
        notification_uuid = self.get_notification_uuid(title_link)
        assert (
            blocks[-2]["elements"][0]["text"]
            == f"{self.project.slug} | <http://example.com/settings/account/notifications/alerts/?referrer=issue_alert-slack-user&notification_uuid={notification_uuid}&organizationId={event.organization.id}|Notification Settings>"
        )

        # check that user2 got a notification as well
        assert data2["channel"] == "UXXXXXXX2"
        assert "blocks" in data2
        blocks = orjson.loads(data2["blocks"])
        assert "Hello world" in blocks[1]["text"]["text"]
        assert (
            blocks[-2]["elements"][0]["text"]
            == f"{self.project.slug} | <http://example.com/settings/account/notifications/alerts/?referrer=issue_alert-slack-user&notification_uuid={notification_uuid}&organizationId={event.organization.id}|Notification Settings>"
        )

    @patch.object(sentry, "digests")
    def test_digest_enabled_block(self, digests):
        """
        Test that with digests enabled, but Slack notification settings
        (and not email settings) enabled, we send a Slack notification with the proper
        payload when block kit is enabled.
        """
        backend = RedisBackend()
        digests.backend.digest = backend.digest
        digests.enabled.return_value = True

        rule = Rule.objects.create(project=self.project, label="my rule")
        ProjectOwnership.objects.create(project_id=self.project.id)
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )

        key = f"mail:p:{self.project.id}:IssueOwners::AllMembers"
        backend.add(key, event_to_record(event, [rule]), increment_delay=0, maximum_delay=0)

        with self.tasks():
            deliver_digest(key)

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]

        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        assert (
            fallback_text
            == f"Alert triggered <http://testserver/organizations/{event.organization.slug}/alerts/rules/{event.project.slug}/{rule.id}/details/|my rule>"
        )
        assert blocks[0]["text"]["text"] == fallback_text
        assert event.group
        assert (
            blocks[1]["text"]["text"]
            == f":red_circle: <http://testserver/organizations/{event.organization.slug}/issues/{event.group.id}/?referrer=issue_alert-slack&notification_uuid={notification_uuid}&alert_rule_id={rule.id}&alert_type=issue|*Hello world*>"
        )
        assert (
            blocks[4]["elements"][0]["text"]
            == f"{event.project.slug} | <http://testserver/settings/account/notifications/alerts/?referrer=issue_alert-slack-user&notification_uuid={notification_uuid}&organizationId={event.organization.id}|Notification Settings>"
        )
