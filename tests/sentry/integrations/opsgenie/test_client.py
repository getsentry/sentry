from unittest.mock import MagicMock, patch

import orjson
import pytest
import responses

from sentry.integrations.opsgenie.client import OpsgenieClient
from sentry.integrations.types import EventLifecycleOutcome
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_halt_metric,
    assert_many_halt_metrics,
    assert_slo_metric,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]

EXTERNAL_ID = "test-app"
METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


class OpsgenieClientTest(APITestCase):
    def setUp(self) -> None:
        self.login_as(self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            external_id=EXTERNAL_ID,
            provider="opsgenie",
            name="test-app",
            metadata=METADATA,
            oi_params={
                "config": {
                    "team_table": [
                        {"id": "team-123", "integration_key": "1234-ABCD", "team": "default team"},
                    ]
                },
            },
        )
        self.installation = self.integration.get_installation(self.organization.id)

    def test_get_client(self) -> None:
        with pytest.raises(NotImplementedError):
            self.installation.get_client()

    def test_get_keyring_client(self) -> None:
        client = self.installation.get_keyring_client("team-123")
        assert client.integration == self.installation.model
        assert client.base_url == METADATA["base_url"] + "v2"
        assert client.integration_key == METADATA["api_key"]

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_notification(self, mock_record: MagicMock) -> None:
        resp_data = {
            "result": "Request will be processed",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(responses.POST, url="https://api.opsgenie.com/v2/alerts", json=resp_data)

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None

        rule = self.create_project_rule(project=self.project, name="my rule")
        rule.data["actions"][0].pop("workflow_id")
        rule.save()

        client: OpsgenieClient = self.installation.get_keyring_client("team-123")
        with self.options({"system.url-prefix": "http://example.com"}):
            payload = client.build_issue_alert_payload(
                data=event,
                rules=[rule],
                event=event,
                group=group,
                priority="P2",
            )
            client.send_notification(payload)

        request = responses.calls[0].request
        payload = orjson.loads(request.body)
        group_id = str(group.id)
        assert payload == {
            "tags": ["level:warning"],
            "entity": "foo.bar",
            "alias": "sentry: %s" % group_id,
            "priority": "P2",
            "details": {
                "Project Name": self.project.name,
                "Triggering Rules": "my rule",
                "Triggering Rule URLs": f"http://example.com/organizations/baz/alerts/rules/{self.project.slug}/{rule.id}/details/",
                "Sentry Group": "Hello world",
                "Sentry ID": group_id,
                "Logger": "",
                "Level": "warning",
                "Project ID": "bar",
                "Issue URL": f"http://example.com/organizations/baz/issues/{group_id}/?referrer=opsgenie",
                "Release": event.release,
            },
            "message": "Hello world",
            "source": "Sentry",
        }
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_notification_with_workflow_engine_trigger_actions(
        self, mock_record: MagicMock
    ) -> None:
        resp_data = {
            "result": "Request will be processed",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(responses.POST, url="https://api.opsgenie.com/v2/alerts", json=resp_data)

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None

        rule = self.create_project_rule()
        rule.data["actions"][0].pop("workflow_id")
        rule.save()

        client: OpsgenieClient = self.installation.get_keyring_client("team-123")
        with self.options({"system.url-prefix": "http://example.com"}):
            payload = client.build_issue_alert_payload(
                data=event,
                rules=[rule],
                event=event,
                group=group,
                priority="P2",
            )
            client.send_notification(payload)

        request = responses.calls[0].request
        payload = orjson.loads(request.body)
        group_id = str(group.id)
        assert payload == {
            "tags": ["level:warning"],
            "entity": "foo.bar",
            "alias": "sentry: %s" % group_id,
            "priority": "P2",
            "details": {
                "Project Name": self.project.name,
                "Triggering Rules": rule.label,
                "Triggering Rule URLs": f"http://example.com/organizations/baz/alerts/rules/{self.project.slug}/{rule.data['actions'][0]['legacy_rule_id']}/details/",
                "Sentry Group": "Hello world",
                "Sentry ID": group_id,
                "Logger": "",
                "Level": "warning",
                "Project ID": "bar",
                "Issue URL": f"http://example.com/organizations/baz/issues/{group_id}/?referrer=opsgenie",
                "Release": event.release,
            },
            "message": "Hello world",
            "source": "Sentry",
        }
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_notification_with_workflow_engine_ui_links(self, mock_record: MagicMock) -> None:
        resp_data = {
            "result": "Request will be processed",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(responses.POST, url="https://api.opsgenie.com/v2/alerts", json=resp_data)

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None

        rule = self.create_project_rule()
        rule.data["actions"][0].pop("legacy_rule_id")
        rule.save()

        client: OpsgenieClient = self.installation.get_keyring_client("team-123")
        with self.options({"system.url-prefix": "http://example.com"}):
            payload = client.build_issue_alert_payload(
                data=event,
                rules=[rule],
                event=event,
                group=group,
                priority="P2",
            )
            client.send_notification(payload)

        request = responses.calls[0].request
        payload = orjson.loads(request.body)
        group_id = str(group.id)
        assert payload == {
            "tags": ["level:warning"],
            "entity": "foo.bar",
            "alias": "sentry: %s" % group_id,
            "priority": "P2",
            "details": {
                "Project Name": self.project.name,
                "Triggering Workflows": rule.label,
                "Triggering Workflow URLs": f"http://example.com/organizations/{self.organization.slug}/monitors/alerts/{rule.data['actions'][0]['workflow_id']}/",
                "Sentry Group": "Hello world",
                "Sentry ID": group_id,
                "Logger": "",
                "Level": "warning",
                "Project ID": "bar",
                "Issue URL": f"http://example.com/organizations/baz/issues/{group_id}/?referrer=opsgenie",
                "Release": event.release,
            },
            "message": "Hello world",
            "source": "Sentry",
        }
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_notification_unauthorized_errors(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/alerts",
            status=401,
            json={"message": ":bufo-riot:"},
        )

        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/alerts",
            status=403,
            json={"code": 40301},
        )

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None

        rule = self.create_project_rule(project=self.project, name="my rule")
        client: OpsgenieClient = self.installation.get_keyring_client("team-123")

        with self.options({"system.url-prefix": "http://example.com"}):
            payload = client.build_issue_alert_payload(
                data=event,
                rules=[rule],
                event=event,
                group=group,
                priority="P2",
            )
            with pytest.raises(ApiUnauthorized):
                client.send_notification(payload)

            with pytest.raises(ApiError):
                client.send_notification(payload)

        # CREATE (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=2
        )
        assert_many_halt_metrics(
            mock_record=mock_record,
            messages_or_errors=[ApiUnauthorized("something"), ApiError("something")],
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_metric_alert_notification_unauthorized_errors(
        self, mock_record: MagicMock
    ) -> None:
        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/alerts",
            status=401,
            json={"message": "bufo-brick"},
        )

        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/alerts",
            status=403,
            json={"code": 40301},
        )
        client: OpsgenieClient = self.installation.get_keyring_client("team-123")

        # Test critical alert (P1)
        critical_payload = {
            "message": "Critical Alert Rule",
            "alias": "incident_123_456",
            "description": "This is a critical alert",
            "source": "Sentry",
            "priority": "P1",
            "details": {
                "URL": "http://example.com/alert/1",
            },
        }

        with pytest.raises(ApiUnauthorized):
            client.send_metric_alert_notification(critical_payload)

        with pytest.raises(ApiError):
            client.send_metric_alert_notification(critical_payload)

        # CREATE (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=2
        )
        assert_many_halt_metrics(
            mock_record=mock_record,
            messages_or_errors=[ApiUnauthorized("something"), ApiError("something")],
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_metric_alert_notification_closed_unauthorized_errors(
        self, mock_record: MagicMock
    ) -> None:
        identifier = "poggers"
        closed_payload = {
            "identifier": identifier,
        }
        responses.add(
            responses.POST,
            url=f"https://api.opsgenie.com/v2/alerts/{identifier}/close?identifierType=alias",
            status=401,
            json={"code": 40301},
        )

        responses.add(
            responses.POST,
            url=f"https://api.opsgenie.com/v2/alerts/{identifier}/close?identifierType=alias",
            status=403,
            json={"message": ":bufo-riot:"},
        )
        client: OpsgenieClient = self.installation.get_keyring_client("team-123")

        with pytest.raises(ApiUnauthorized):
            client.send_metric_alert_notification(closed_payload)

        with pytest.raises(ApiError):
            client.send_metric_alert_notification(closed_payload)

        # CREATE (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

        assert_halt_metric(mock_record=mock_record, error_msg=ApiError("something"))
