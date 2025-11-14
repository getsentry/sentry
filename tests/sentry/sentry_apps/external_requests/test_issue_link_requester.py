from typing import int
from unittest.mock import MagicMock, patch

import pytest
import responses
from requests import HTTPError

from sentry.integrations.types import EventLifecycleOutcome
from sentry.sentry_apps.external_requests.issue_link_requester import (
    FAILURE_REASON_BASE,
    IssueLinkRequester,
    IssueRequestActionType,
)
from sentry.sentry_apps.metrics import SentryAppEventType, SentryAppExternalRequestHaltReason
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_halt_metric,
    assert_many_halt_metrics,
    assert_success_metric,
)
from sentry.testutils.cases import TestCase
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils import json
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


class TestIssueLinkRequester(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user(name="foo")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(slug="boop", organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="foo", organization=self.org, webhook_url="https://example.com", scopes=()
        )

        self.orm_install = self.create_sentry_app_installation(
            slug="foo", organization=self.org, user=self.user
        )
        self.rpc_user = serialize_rpc_user(self.user)
        self.install = app_service.get_many(filter=dict(installation_ids=[self.orm_install.id]))[0]

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_makes_request(self, mock_record: MagicMock) -> None:
        fields = {"title": "An Issue", "description": "a bug was found", "assignee": "user-1"}

        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            json={
                "project": "ProjectName",
                "webUrl": "https://example.com/project/issue-id",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        result = IssueLinkRequester(
            install=self.install,
            group=self.group,
            uri="/link-issue",
            fields=fields,
            user=self.rpc_user,
            action=IssueRequestActionType("create"),
        ).run()
        assert result == {
            "project": "ProjectName",
            "webUrl": "https://example.com/project/issue-id",
            "identifier": "issue-1",
        }

        request = responses.calls[0].request
        data = {
            "fields": {"title": "An Issue", "description": "a bug was found", "assignee": "user-1"},
            "issueId": self.group.id,
            "installationId": self.install.uuid,
            "webUrl": self.group.get_absolute_url(),
            "project": {"id": self.project.id, "slug": self.project.slug},
            "actor": {"type": "user", "id": self.user.id, "name": self.user.name},
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
        assert requests[0]["event_type"] == "external_issue.created"

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
    def test_invalid_response_format(self, mock_record: MagicMock) -> None:
        # missing 'identifier'
        invalid_format = {
            "project": "ProjectName",
            "webUrl": "https://example.com/project/issue-id",
        }
        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            json=invalid_format,
            status=200,
            content_type="application/json",
        )
        with pytest.raises(SentryAppIntegratorError) as exception_info:
            IssueLinkRequester(
                install=self.install,
                group=self.group,
                uri="/link-issue",
                fields={},
                user=self.rpc_user,
                action=IssueRequestActionType("create"),
            ).run()

        assert exception_info.value.webhook_context == {
            "error_type": FAILURE_REASON_BASE.format(
                SentryAppExternalRequestHaltReason.BAD_RESPONSE
            ),
            "uri": "/link-issue",
            "installation_uuid": self.install.uuid,
            "sentry_app_slug": self.sentry_app.slug,
            "project_slug": self.group.project.slug,
            "group_id": self.group.id,
            "response": invalid_format,
        }

        # SLO assertions
        assert_halt_metric(
            mock_record,
            f"{SentryAppEventType.EXTERNAL_ISSUE_LINKED}.{SentryAppExternalRequestHaltReason.BAD_RESPONSE}",
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
    def test_500_response(self, mock_record: MagicMock) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            body="Something failed",
            status=500,
        )

        with pytest.raises(SentryAppIntegratorError) as exception_info:
            IssueLinkRequester(
                install=self.install,
                group=self.group,
                uri="/link-issue",
                fields={},
                user=self.rpc_user,
                action=IssueRequestActionType("create"),
            ).run()

        assert exception_info.value.webhook_context == {
            "error_type": FAILURE_REASON_BASE.format(
                SentryAppExternalRequestHaltReason.BAD_RESPONSE
            ),
            "uri": "/link-issue",
            "installation_uuid": self.install.uuid,
            "sentry_app_slug": self.sentry_app.slug,
            "project_slug": self.group.project.slug,
            "group_id": self.group.id,
            "error_message": "500 Server Error: Internal Server Error for url: https://example.com/link-issue",
        }

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()
        assert len(requests) == 1
        assert requests[0]["response_code"] == 500
        assert requests[0]["event_type"] == "external_issue.created"

        # SLO assertions
        # We recieved back a 500 response from 3p
        assert_many_halt_metrics(mock_record, [HTTPError(), HTTPError()])

        # EXTERNAL_REQUEST (halt) -> EXTERNAL_REQUEST (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=2
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_invalid_json_response(self, mock_record: MagicMock) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            body="not valid json}",
            status=200,
            content_type="application/json",
        )

        with pytest.raises(SentryAppIntegratorError) as exception_info:
            IssueLinkRequester(
                install=self.install,
                group=self.group,
                uri="/link-issue",
                fields={},
                user=self.rpc_user,
                action=IssueRequestActionType("create"),
            ).run()

        assert exception_info.value.webhook_context == {
            "error_type": FAILURE_REASON_BASE.format(
                SentryAppExternalRequestHaltReason.BAD_RESPONSE
            ),
            "uri": "/link-issue",
            "installation_uuid": self.install.uuid,
            "sentry_app_slug": self.sentry_app.slug,
            "project_slug": self.group.project.slug,
            "group_id": self.group.id,
            "response_body": b"not valid json}",
        }

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "external_issue.created"

        # SLO assertions
        assert_halt_metric(
            mock_record,
            json.JSONDecodeError("Expecting value", "not valid json}", 0),
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
