from typing import int
from unittest.mock import MagicMock, patch

import pytest
import responses
from requests import HTTPError

from sentry.integrations.types import EventLifecycleOutcome
from sentry.sentry_apps.external_requests.select_requester import SelectRequester
from sentry.sentry_apps.metrics import (
    SentryAppEventType,
    SentryAppExternalRequestFailureReason,
    SentryAppExternalRequestHaltReason,
)
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_failure_metric,
    assert_halt_metric,
    assert_many_halt_metrics,
    assert_success_metric,
)
from sentry.testutils.cases import TestCase
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


class TestSelectRequester(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user(name="foo")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(slug="boop", organization=self.org)

        self.sentry_app = self.create_sentry_app(
            name="foo", organization=self.org, webhook_url="https://example.com", scopes=()
        )

        self.orm_install = self.create_sentry_app_installation(
            slug="foo", organization=self.org, user=self.user
        )
        self.install = app_service.get_many(filter=dict(installation_ids=[self.orm_install.id]))[0]

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_makes_request(self, mock_record: MagicMock) -> None:
        options = [
            {"label": "An Issue", "value": "123", "default": True},
            {"label": "Another Issue", "value": "456"},
        ]
        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            json=options,
            status=200,
            content_type="application/json",
        )

        result = SelectRequester(
            install=self.install, project_slug=self.project.slug, uri="/get-issues"
        ).run()

        assert result == {
            "choices": [["123", "An Issue"], ["456", "Another Issue"]],
            "defaultValue": "123",
        }

        request = responses.calls[0].request
        assert request.headers["Sentry-App-Signature"] == self.sentry_app.build_signature("")
        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "select_options.requested"

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
    def test_invalid_response_missing_label(self, mock_record: MagicMock) -> None:
        # missing 'label'
        url = f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}"
        uri = "/get-issues"

        invalid_format = {"value": "12345"}
        responses.add(
            method=responses.GET,
            url=url,
            json=invalid_format,
            status=200,
            content_type="application/json",
        )

        with pytest.raises(SentryAppIntegratorError) as exception_info:
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri=uri,
            ).run()
        assert (
            exception_info.value.message
            == f"Invalid response format for Select FormField in {self.sentry_app.slug} from uri: {uri}"
        )
        assert exception_info.value.webhook_context == {
            "error_type": f"{SentryAppEventType.SELECT_OPTIONS_REQUESTED}.{SentryAppExternalRequestHaltReason.MISSING_FIELDS}",
            "response": invalid_format,
            "sentry_app_slug": self.sentry_app.slug,
            "install_uuid": self.install.uuid,
            "project_slug": self.project.slug,
            "url": url,
        }

        # SLO assertions
        assert_halt_metric(
            mock_record,
            f"{SentryAppEventType.SELECT_OPTIONS_REQUESTED}.{SentryAppExternalRequestHaltReason.MISSING_FIELDS}",
        )

        # EXTERNAL_REQUEST (halt) -> EXTERNAL_REQUEST (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_invalid_response_missing_value(self, mock_record: MagicMock) -> None:
        # missing 'label' and 'value'
        invalid_format = [
            {"project": "ACME", "webUrl": "foo"},
        ]
        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            json=invalid_format,
            status=200,
            content_type="application/json",
        )

        with pytest.raises(SentryAppIntegratorError) as exception_info:
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri="/get-issues",
            ).run()

        assert (
            exception_info.value.message
            == "Missing `value` or `label` in option data for Select FormField"
        )
        assert exception_info.value.webhook_context == {
            "error_type": f"{SentryAppEventType.SELECT_OPTIONS_REQUESTED}.{SentryAppExternalRequestHaltReason.MISSING_FIELDS}",
            "response": invalid_format,
        }

        # SLO assertions
        assert_halt_metric(
            mock_record,
            SentryAppIntegratorError(
                message="Missing `value` or `label` in option data for Select FormField"
            ),
        )
        # EXTERNAL_REQUEST (halt) -> EXTERNAL_REQUEST (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @responses.activate
    def test_500_response(self) -> None:
        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            body="Something failed",
            status=500,
        )

        with pytest.raises(SentryAppIntegratorError):
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri="/get-issues",
            ).run()

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 500
        assert requests[0]["event_type"] == "select_options.requested"

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_api_error_message(self, mock_record: MagicMock) -> None:
        url = f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}"
        responses.add(
            method=responses.GET,
            url=url,
            body="Something failed",
            status=500,
        )

        with pytest.raises(SentryAppIntegratorError) as exception_info:
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri="/get-issues",
            ).run()
        assert (
            exception_info.value.message
            == f"Something went wrong while getting options for Select FormField from {self.sentry_app.slug}"
        )
        assert exception_info.value.webhook_context == {
            "error_type": f"{SentryAppEventType.SELECT_OPTIONS_REQUESTED}.{SentryAppExternalRequestHaltReason.BAD_RESPONSE}",
            "sentry_app_slug": self.sentry_app.slug,
            "install_uuid": self.install.uuid,
            "project_slug": self.project.slug,
            "url": url,
        }

        # SLO assertions
        assert_many_halt_metrics(
            mock_record,
            [HTTPError(), HTTPError()],
        )

        # EXTERNAL_REQUEST (halt) -> EXTERNAL_REQUEST (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=2
        )

    @responses.activate
    @patch("sentry.sentry_apps.external_requests.select_requester.SelectRequester._build_url")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_url_fail_error(self, mock_record: MagicMock, mock_build_url: MagicMock) -> None:
        mock_build_url.side_effect = Exception()

        uri = "asdhbaljkdnaklskand"
        with pytest.raises(SentryAppSentryError) as exception_info:
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri=uri,
            ).run()

        assert (
            exception_info.value.message
            == "Something went wrong while preparing to get Select FormField options"
        )
        assert exception_info.value.webhook_context == {
            "error_type": f"{SentryAppEventType.SELECT_OPTIONS_REQUESTED}.{SentryAppExternalRequestFailureReason.MISSING_URL}",
            "sentry_app_slug": self.sentry_app.slug,
            "install_uuid": self.install.uuid,
            "project_slug": self.project.slug,
            "uri": uri,
            "dependent_data": None,
            "webhook_url": self.sentry_app.webhook_url,
        }

        # SLO assertions
        assert_failure_metric(
            mock_record,
            SentryAppSentryError(
                message="Something went wrong while preparing to get Select FormField options"
            ),
        )

        # EXTERNAL_REQUEST (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @responses.activate
    @patch("sentry.sentry_apps.external_requests.select_requester.send_and_save_sentry_app_request")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unexpected_exception(
        self, mock_record: MagicMock, mock_send_request: MagicMock
    ) -> None:
        mock_send_request.side_effect = Exception()

        uri = "asdhbaljkdnaklskand"
        with pytest.raises(SentryAppSentryError) as exception_info:
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri=uri,
            ).run()

        assert (
            exception_info.value.message
            == "Something went wrong while preparing to get Select FormField options"
        )
        assert exception_info.value.webhook_context == {
            "error_type": f"{SentryAppEventType.SELECT_OPTIONS_REQUESTED}.{SentryAppExternalRequestFailureReason.UNEXPECTED_ERROR}",
            "sentry_app_slug": self.sentry_app.slug,
            "install_uuid": self.install.uuid,
            "project_slug": self.project.slug,
            "url": f"https://example.com/{uri}?installationId={self.install.uuid}&projectSlug={self.project.slug}",
        }

        # SLO assertions
        assert_failure_metric(
            mock_record,
            SentryAppSentryError(
                message="Something went wrong while preparing to get Select FormField options"
            ),
        )

        # EXTERNAL_REQUEST (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )
