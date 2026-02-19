from collections.abc import Mapping
from unittest.mock import MagicMock, patch

import responses
from requests import HTTPError

from sentry.integrations.types import EventLifecycleOutcome
from sentry.sentry_apps.external_requests.alert_rule_action_requester import (
    DEFAULT_ERROR_MESSAGE,
    DEFAULT_SUCCESS_MESSAGE,
    FAILURE_REASON_BASE,
    SentryAppAlertRuleActionRequester,
)
from sentry.sentry_apps.metrics import (
    SentryAppExternalRequestFailureReason,
    SentryAppExternalRequestHaltReason,
)
from sentry.sentry_apps.utils.errors import SentryAppErrorType
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_many_failure_metrics,
    assert_many_halt_metrics,
    assert_success_metric,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


@control_silo_test
class TestSentryAppAlertRuleActionRequester(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user(name="foo")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(slug="boop", organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.org,
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
        )

        self.install = self.create_sentry_app_installation(
            slug="foo", organization=self.org, user=self.user
        )
        self.fields: list[Mapping[str, str]] = [
            {"name": "title", "value": "An Alert"},
            {"name": "description", "value": "threshold reached"},
            {"name": "assignee_id", "value": "user-1"},
        ]
        self.error_message = "Channel not found!"
        self.success_message = "Created alert!"

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_makes_successful_request(self, mock_record: MagicMock) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
        )

        result = SentryAppAlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {DEFAULT_SUCCESS_MESSAGE}"
        request = responses.calls[0].request

        data = {
            "fields": self.fields,
            "installationId": self.install.uuid,
        }
        payload = json.loads(request.body)
        assert payload == data

        assert request.headers["Sentry-App-Signature"] == self.sentry_app.build_signature(
            json.dumps(payload)
        )

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "alert_rule_action.requested"

        # SLO assertions
        assert_success_metric(mock_record)

        # EXTERNAL_REQUEST (success) -> EXTERNAL_REQUEST (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_makes_successful_request_with_message(self, mock_record: MagicMock) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
            json={"message": self.success_message},
        )

        result = SentryAppAlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {self.success_message}"

        # SLO assertions
        assert_success_metric(mock_record)

        # EXTERNAL_REQUEST (success) -> EXTERNAL_REQUEST (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_makes_successful_request_with_malformed_message(self, mock_record: MagicMock) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
            body=self.success_message.encode(),
        )
        result = SentryAppAlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {DEFAULT_SUCCESS_MESSAGE}"

        # SLO assertions
        assert_success_metric(mock_record)

        # EXTERNAL_REQUEST (success) -> EXTERNAL_REQUEST (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_makes_failed_request(self, mock_record: MagicMock) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=401,
        )

        result = SentryAppAlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert not result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {DEFAULT_ERROR_MESSAGE}"
        request = responses.calls[0].request

        data = {
            "fields": [
                {"name": "title", "value": "An Alert"},
                {"name": "description", "value": "threshold reached"},
                {
                    "name": "assignee_id",
                    "value": "user-1",
                },
            ],
            "installationId": self.install.uuid,
        }
        payload = json.loads(request.body)
        assert payload == data

        assert request.headers["Sentry-App-Signature"] == self.sentry_app.build_signature(
            json.dumps(payload)
        )

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 401
        assert result["message"] == f"{self.sentry_app.name}: {DEFAULT_ERROR_MESSAGE}"
        assert result["error_type"] == SentryAppErrorType.INTEGRATOR
        assert result["webhook_context"] == {
            "error_type": FAILURE_REASON_BASE.format(
                SentryAppExternalRequestHaltReason.BAD_RESPONSE
            ),
            "uri": "/sentry/alert-rule",
            "installation_uuid": self.install.uuid,
            "sentry_app_slug": self.sentry_app.slug,
        }

        # SLO assertions
        # EXTERNAL_REQUEST (halt) -> EXTERNAL_REQUEST (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=2
        )

        assert_many_halt_metrics(
            mock_record=mock_record, messages_or_errors=[HTTPError("401"), HTTPError("401")]
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_makes_failed_request_with_message(self, mock_record: MagicMock) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=401,
            json={"message": self.error_message},
        )
        result = SentryAppAlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert not result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {self.error_message}"
        assert result["error_type"] == SentryAppErrorType.INTEGRATOR
        assert result["webhook_context"] == {
            "error_type": FAILURE_REASON_BASE.format(
                SentryAppExternalRequestHaltReason.BAD_RESPONSE
            ),
            "uri": "/sentry/alert-rule",
            "installation_uuid": self.install.uuid,
            "sentry_app_slug": self.sentry_app.slug,
        }

        # SLO assertions
        # EXTERNAL_REQUEST (halt) -> EXTERNAL_REQUEST (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=2
        )

        assert_many_halt_metrics(
            mock_record=mock_record, messages_or_errors=[HTTPError("401"), HTTPError("401")]
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_makes_failed_request_with_malformed_message(self, mock_record: MagicMock) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=401,
            body=json.dumps({"message": self.error_message}),
        )
        result = SentryAppAlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert not result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {self.error_message}"
        assert result["error_type"] == SentryAppErrorType.INTEGRATOR
        assert result["webhook_context"] == {
            "error_type": FAILURE_REASON_BASE.format(
                SentryAppExternalRequestHaltReason.BAD_RESPONSE
            ),
            "uri": "/sentry/alert-rule",
            "installation_uuid": self.install.uuid,
            "sentry_app_slug": self.sentry_app.slug,
        }

        # SLO assertions
        # EXTERNAL_REQUEST (halt) -> EXTERNAL_REQUEST (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=2
        )

        assert_many_halt_metrics(
            mock_record=mock_record, messages_or_errors=[HTTPError("401"), HTTPError("401")]
        )

    @responses.activate
    @patch("sentry.sentry_apps.external_requests.utils.safe_urlopen")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_makes_failed_request_with_sentry_error(
        self, mock_record: MagicMock, mock_urlopen: MagicMock
    ) -> None:
        mock_urlopen.side_effect = Exception()
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=500,
            body=json.dumps({"message": self.error_message}),
        )
        result = SentryAppAlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert not result["success"]
        assert result["message"] == DEFAULT_ERROR_MESSAGE
        assert result["error_type"] == SentryAppErrorType.SENTRY
        assert result["webhook_context"] == {
            "error_type": FAILURE_REASON_BASE.format(
                SentryAppExternalRequestFailureReason.UNEXPECTED_ERROR
            ),
            "uri": "/sentry/alert-rule",
            "installation_uuid": self.install.uuid,
            "sentry_app_slug": self.sentry_app.slug,
        }

        # SLO assertions
        # EXTERNAL_REQUEST (failure) -> EXTERNAL_REQUEST (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=2
        )

        assert_many_failure_metrics(
            mock_record=mock_record, messages_or_errors=[Exception(), Exception()]
        )
