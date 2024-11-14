from unittest.mock import MagicMock, patch

import orjson
import pytest
import responses

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.opsgenie.actions import OpsgenieNotifyTeamAction
from sentry.integrations.types import EventLifecycleOutcome
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import PerformanceIssueTestCase, RuleTestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]

METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


class OpsgenieNotifyTeamTest(RuleTestCase, PerformanceIssueTestCase):
    rule_cls = OpsgenieNotifyTeamAction

    def _create_integration(self, name):
        integration = self.create_provider_integration(
            provider="opsgenie", name=name, external_id=name, metadata=METADATA
        )
        integration.add_organization(self.organization, self.user)
        return integration

    def setUp(self):
        self.team1 = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self._create_integration(name="test-app")
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.integration.id
            )
            self.org_integration.config = {"team_table": [self.team1]}
            self.org_integration.save()
        self.installation = self.integration.get_installation(self.organization.id)

    @responses.activate
    @patch("sentry.analytics.record")
    def test_applies_correctly(self, mock_record):
        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )

        rule = self.get_rule(data={"account": self.integration.id, "team": self.team1["id"]})
        notification_uuid = "123e4567-e89b-12d3-a456-426614174000"
        results = list(rule.after(event=event, notification_uuid=notification_uuid))
        assert len(results) == 1

        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/alerts",
            json={},
            status=202,
        )

        results[0].callback(event, futures=[])
        data = orjson.loads(responses.calls[0].request.body)

        assert event.group is not None
        assert data["message"] == event.message
        assert data["details"]["Sentry ID"] == str(event.group.id)
        mock_record.assert_called_with(
            "alert.sent",
            provider="opsgenie",
            alert_id="",
            alert_type="issue_alert",
            organization_id=self.organization.id,
            project_id=self.project.id,
            external_id=self.team1["id"],
            notification_uuid=notification_uuid,
        )
        mock_record.assert_any_call(
            "integrations.opsgenie.notification_sent",
            category="issue_alert",
            organization_id=self.organization.id,
            project_id=self.project.id,
            group_id=event.group_id,
            notification_uuid=notification_uuid,
            alert_id=None,
        )

    def test_render_label(self):
        rule = self.get_rule(
            data={"account": self.integration.id, "team": self.team1["id"], "priority": "P2"}
        )

        assert (
            rule.render_label()
            == "Send a notification to Opsgenie account test-app and team cool-team with P2 priority"
        )

    def test_render_label_without_integration(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()

        rule = self.get_rule(
            data={"account": self.integration.id, "team": self.team1["id"], "priority": "P2"}
        )

        label = rule.render_label()
        assert (
            label
            == "Send a notification to Opsgenie account [removed] and team [removed] with P2 priority"
        )

    def test_render_label_no_priority(self):
        rule = self.get_rule(data={"account": self.integration.id, "team": self.team1["id"]})

        assert (
            rule.render_label()
            == "Send a notification to Opsgenie account test-app and team cool-team with P3 priority"
        )

    def test_valid_team_options(self):
        new_org = self.create_organization(name="New Org", owner=self.user)

        new_project = self.create_project(name="new proj", organization=new_org)
        self.project = new_project

        team2 = {"id": "456-id", "team": "cooler-team", "integration_key": "1234-7890"}
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(new_org, self.user)
            oi = OrganizationIntegration.objects.get(organization_id=new_org.id)
            oi.config = {"team_table": [team2]}
            oi.save()

        rule = self.get_rule(data={"account": self.integration.id})
        team_options = rule.get_teams()
        assert team_options == [(team2["id"], team2["team"])]
        assert "choice" == rule.form_fields["team"]["type"]
        assert team_options == rule.form_fields["team"]["choices"]

    @responses.activate
    def test_valid_team_selected(self):
        rule = self.get_rule(data={"account": self.integration.id, "team": self.team1["id"]})
        form = rule.get_form_instance()
        assert form.is_valid()

    def test_invalid_int_id(self):
        rule = self.get_rule(data={"account": "blah", "team": self.team1["id"]})
        form = rule.get_form_instance()
        assert not form.is_valid()

    @responses.activate
    def test_notifies_with_multiple_og_accounts(self):
        team2 = {"id": "456-id", "team": "cooler-team", "integration_key": "1234-7890"}
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self._create_integration("test-app-2")
            org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=integration.id
            )
            org_integration.config = {"team_table": [team2]}
            org_integration.save()
        self.installation = integration.get_installation(self.organization.id)
        event = self.get_event()

        rule = self.get_rule(data={"account": integration.id, "team": team2["id"]})

        results = list(rule.after(event=event))
        assert len(results) == 1

        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/alerts",
            json={},
            status=202,
        )

        results[0].callback(event, futures=[])
        data = orjson.loads(responses.calls[0].request.body)

        assert event.group is not None
        assert data["message"] == event.message
        assert data["details"]["Sentry ID"] == str(event.group.id)

    @responses.activate
    def test_invalid_team_selected(self):
        team2 = {"id": "456-id", "team": "cooler-team", "integration_key": "1234-7890"}
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self._create_integration("test-app-2")
            org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=integration.id
            )
            org_integration.config = {"team_table": [team2]}
            org_integration.save()
        self.installation = integration.get_installation(self.organization.id)

        rule = self.get_rule(data={"account": self.integration.id, "team": team2["id"]})

        form = rule.get_form_instance()
        assert not form.is_valid()
        assert len(form.errors) == 1

    @patch("sentry.integrations.opsgenie.actions.notification.logger")
    def test_team_deleted(self, mock_logger: MagicMock):
        team2 = {"id": "456-id", "team": "cooler-team", "integration_key": "1234-7890"}
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self._create_integration("test-app-2")
            org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=integration.id
            )
            org_integration.config = {"team_table": [team2]}
            org_integration.save()
        self.installation = integration.get_installation(self.organization.id)
        event = self.get_event()
        rule = self.get_rule(data={"account": integration.id, "team": team2["id"]})

        results = list(rule.after(event=event))
        assert len(results) == 1

        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration.config = {"team_table": []}
            org_integration.save()
        event = self.get_event()
        rule = self.get_rule(data={"account": integration.id, "team": team2["id"]})

        results = list(rule.after(event=event))
        assert len(results) == 0
        assert (
            mock_logger.error.call_args.args[0]
            == "The Opsgenie team no longer exists, or the team does not belong to the selected account."
        )

    @patch("sentry.integrations.opsgenie.actions.notification.logger")
    def test_integration_deleted(self, mock_logger: MagicMock):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()

        event = self.get_event()
        rule = self.get_rule(data={"account": self.integration.id, "team": self.team1["id"]})

        results = list(rule.after(event=event))
        assert len(results) == 0
        assert (
            mock_logger.error.call_args.args[0]
            == "Integration removed, but the rule still refers to it"
        )

    @patch("sentry.integrations.opsgenie.actions.notification.logger")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_api_error(self, mock_record, mock_logger: MagicMock):
        event = self.get_event()
        rule = self.get_rule(data={"account": self.integration.id, "team": self.team1["id"]})
        results = list(rule.after(event=event))
        assert len(results) == 1

        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/alerts",
            status=400,
        )

        with pytest.raises(ApiError):
            results[0].callback(event, futures=[])
        assert mock_logger.info.call_args.args[0] == "rule.fail.opsgenie_notification"
        assert len(mock_record.mock_calls) == 2
        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.FAILURE
