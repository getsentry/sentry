from collections import namedtuple
from unittest.mock import ANY, MagicMock, patch

import pytest
import responses
from django.urls import reverse
from requests import HTTPError
from requests.exceptions import ChunkedEncodingError, ConnectionError, Timeout

from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import convert_dict_key_case, snake_to_camel_case
from sentry.constants import SentryAppStatus
from sentry.eventstream.types import EventStreamEventType
from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.types import EventLifecycleOutcome
from sentry.issues.ingest import save_issue_occurrence
from sentry.models.activity import Activity
from sentry.sentry_apps.metrics import SentryAppWebhookFailureReason, SentryAppWebhookHaltReason
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.servicehook import ServiceHook, ServiceHookProject
from sentry.sentry_apps.tasks.sentry_apps import (
    build_comment_webhook,
    installation_webhook,
    notify_sentry_app,
    process_resource_change_bound,
    regenerate_service_hooks_for_installation,
    send_alert_webhook_v2,
    send_webhooks,
    workflow_notification,
)
from sentry.sentry_apps.utils.errors import SentryAppSentryError
from sentry.services.eventstore.models import GroupEvent
from sentry.shared_integrations.exceptions import ClientError
from sentry.silo.base import SiloMode
from sentry.tasks.post_process import post_process_group
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_failure_metric,
    assert_halt_metric,
    assert_many_halt_metrics,
    assert_success_metric,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.rules import RuleFuture
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer
from sentry.utils.sentry_apps.service_hook_manager import (
    create_or_update_service_hooks_for_installation,
)
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]


def raiseStatusFalse() -> bool:
    return False


def raiseStatusTrue() -> bool:
    return True


def raiseException():
    raise Exception


def raiseHTTPError():
    raise HTTPError()


class RequestMock:
    def __init__(self):
        self.body = "blah blah"


headers = {"Sentry-Hook-Error": "d5111da2c28645c5889d072017e3445d", "Sentry-Hook-Project": "1"}
html_content = "a bunch of garbage HTML"
json_content = '{"error": "bad request"}'

MockResponse = namedtuple(
    "MockResponse",
    ["headers", "content", "text", "ok", "status_code", "raise_for_status", "request"],
)

MockFailureHTMLContentResponseInstance = MockResponse(
    headers, html_content, "", True, 400, raiseStatusFalse, RequestMock()
)
MockFailureJSONContentResponseInstance = MockResponse(
    headers, json_content, "", True, 400, raiseStatusFalse, RequestMock()
)
MockFailureResponseInstance = MockResponse(
    headers, html_content, "", True, 400, raiseStatusFalse, RequestMock()
)
MockResponseWithHeadersInstance = MockResponse(
    headers, html_content, "", True, 400, raiseStatusFalse, RequestMock()
)
MockResponseInstance = MockResponse({}, b"{}", "", True, 200, raiseStatusFalse, None)
MockResponse404 = MockResponse({}, b'{"bruh": "bruhhhhhhh"}', "", False, 404, raiseException, None)
MockResponse504 = MockResponse(headers, json_content, "", False, 504, raiseStatusFalse, None)
MockResponse503 = MockResponse(headers, json_content, "", False, 503, raiseStatusFalse, None)
MockResponse502 = MockResponse(headers, json_content, "", False, 502, raiseHTTPError, None)


class TestSendAlertEvent(TestCase, OccurrenceTestMixin):
    def setUp(self) -> None:
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.rule = self.create_project_rule(name="Issa Rule")
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_no_sentry_app_for_send_alert_event_v2(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        group_event = GroupEvent.from_event(event, event.group)
        send_alert_webhook_v2(
            instance_id=group_event.event_id,
            group_id=group_event.group_id,
            occurrence_id=None,
            rule_label=self.rule.label,
            sentry_app_id=9999,
        )

        assert not safe_urlopen.called

        assert_failure_metric(
            mock_record=mock_record,
            error_msg=SentryAppSentryError(
                message=SentryAppWebhookFailureReason.MISSING_SENTRY_APP
            ),
        )
        # PREPARE_WEBHOOK (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_missing_event(self, mock_record: MagicMock, safe_urlopen: MagicMock) -> None:
        project = self.create_project()
        issue = self.create_group(project=project)

        send_alert_webhook_v2(
            instance_id=123,
            group_id=issue.id,
            occurrence_id=None,
            rule_label=self.rule.label,
            sentry_app_id=self.sentry_app.id,
        )

        assert not safe_urlopen.called

        assert_failure_metric(
            mock_record, SentryAppSentryError(message=SentryAppWebhookFailureReason.MISSING_EVENT)
        )
        # PREPARE_WEBHOOK (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_no_sentry_app_in_future(self, safe_urlopen: MagicMock) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        group_event = GroupEvent.from_event(event, event.group)
        rule_future = RuleFuture(rule=self.rule, kwargs={})

        with self.tasks():
            notify_sentry_app(group_event, [rule_future])

        assert not safe_urlopen.called

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_no_installation(self, mock_record: MagicMock, safe_urlopen: MagicMock) -> None:
        sentry_app = self.create_sentry_app(organization=self.organization)
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        group_event = GroupEvent.from_event(event, event.group)
        rule_future = RuleFuture(rule=self.rule, kwargs={"sentry_app": sentry_app})

        with self.tasks():
            notify_sentry_app(group_event, [rule_future])

        assert not safe_urlopen.called
        assert_halt_metric(
            mock_record=mock_record, error_msg=SentryAppWebhookHaltReason.MISSING_INSTALLATION
        )
        # APP_CREATE (success) -> PREPARE_WEBHOOK (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_alert_event(self, mock_record: MagicMock, safe_urlopen: MagicMock) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        group = event.group
        group_event = GroupEvent.from_event(event, group)
        rule_future = RuleFuture(rule=self.rule, kwargs={"sentry_app": self.sentry_app})

        with self.tasks():
            notify_sentry_app(group_event, [rule_future])

        ((args, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])
        assert data == {
            "action": "triggered",
            "installation": {"uuid": self.install.uuid},
            "data": {
                "event": ANY,  # tested below
                "triggered_rule": self.rule.label,
            },
            "actor": {"type": "application", "id": "sentry", "name": "Sentry"},
        }
        assert data["data"]["event"]["project"] == self.project.id
        assert data["data"]["event"]["event_id"] == group_event.event_id
        assert data["data"]["event"]["url"] == absolute_uri(
            reverse(
                "sentry-api-0-project-event-details",
                args=[self.organization.slug, self.project.slug, group_event.event_id],
            )
        )
        assert data["data"]["event"]["web_url"] == absolute_uri(
            reverse(
                "sentry-organization-event-detail",
                args=[self.organization.slug, group.id, group_event.event_id],
            )
        )
        assert data["data"]["event"]["issue_url"] == absolute_uri(
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/"
        )
        assert data["data"]["event"]["issue_id"] == str(group.id)

        assert kwargs["headers"].keys() >= {
            "Content-Type",
            "Request-ID",
            "Sentry-Hook-Resource",
            "Sentry-Hook-Timestamp",
            "Sentry-Hook-Signature",
        }

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "event_alert.triggered"

        # SLO validation
        assert_success_metric(mock_record=mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_alert_event_with_additional_payload(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        group_event = GroupEvent.from_event(event, event.group)
        settings = [
            {"name": "alert_prefix", "value": "[Not Good]"},
            {"name": "channel", "value": "#ignored-errors"},
            {"name": "best_emoji", "value": ":fire:"},
            {"name": "teamId", "value": 1},
            {"name": "assigneeId", "value": 3},
        ]

        rule_future = RuleFuture(
            rule=self.rule,
            kwargs={"sentry_app": self.sentry_app, "schema_defined_settings": settings},
        )

        with self.tasks():
            notify_sentry_app(group_event, [rule_future])

        ((args, kwargs),) = safe_urlopen.call_args_list
        payload = json.loads(kwargs["data"])

        assert payload["action"] == "triggered"
        assert payload["data"]["triggered_rule"] == self.rule.label
        assert payload["data"]["issue_alert"] == {
            "id": self.rule.id,
            "title": self.rule.label,
            "sentry_app_id": self.sentry_app.id,
            "settings": settings,
        }

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "event_alert.triggered"

        # SLO validation
        assert_success_metric(mock_record=mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @override_options({"workflow_engine.issue_alert.group.type_id.ga": [1]})
    def test_send_alert_event_with_additional_payload_legacy_rule_id(
        self, mock_record, safe_urlopen
    ):
        rule = self.create_project_rule(
            action_data=[{"sentryAppInstallationUuid": self.install.uuid}]
        )
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        group_event = GroupEvent.from_event(event, event.group)
        settings = [
            {"name": "alert_prefix", "value": "[Not Good]"},
            {"name": "channel", "value": "#ignored-errors"},
            {"name": "best_emoji", "value": ":fire:"},
            {"name": "teamId", "value": 1},
            {"name": "assigneeId", "value": 3},
        ]

        rule_future = RuleFuture(
            rule=rule,
            kwargs={"sentry_app": self.sentry_app, "schema_defined_settings": settings},
        )

        with self.tasks():
            notify_sentry_app(group_event, [rule_future])

        ((args, kwargs),) = safe_urlopen.call_args_list
        payload = json.loads(kwargs["data"])

        assert payload["action"] == "triggered"
        assert payload["data"]["triggered_rule"] == rule.label
        assert payload["data"]["issue_alert"] == {
            # Use the legacy rule id
            "id": rule.data["actions"][0]["legacy_rule_id"],
            "title": rule.label,
            "sentry_app_id": self.sentry_app.id,
            "settings": settings,
        }

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "event_alert.triggered"

        # SLO validation
        assert_success_metric(mock_record=mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_alert_event_with_groupevent(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence_data = self.build_occurrence_data(
            event_id=event.event_id, project_id=self.project.id
        )
        occurrence, group_info = save_issue_occurrence(occurrence_data=occurrence_data, event=event)
        assert group_info is not None

        group_event = event.for_group(group_info.group)
        group_event.occurrence = occurrence
        rule_future = RuleFuture(rule=self.rule, kwargs={"sentry_app": self.sentry_app})

        with self.tasks():
            notify_sentry_app(group_event, [rule_future])

        ((args, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])
        assert data == {
            "action": "triggered",
            "installation": {"uuid": self.install.uuid},
            "data": {
                "event": ANY,  # tested below
                "triggered_rule": self.rule.label,
            },
            "actor": {"type": "application", "id": "sentry", "name": "Sentry"},
        }
        assert data["data"]["event"]["project"] == self.project.id
        assert data["data"]["event"]["event_id"] == group_event.event_id
        assert data["data"]["event"]["url"] == absolute_uri(
            reverse(
                "sentry-api-0-project-event-details",
                args=[self.organization.slug, self.project.slug, group_event.event_id],
            )
        )
        assert data["data"]["event"]["web_url"] == absolute_uri(
            reverse(
                "sentry-organization-event-detail",
                args=[self.organization.slug, group_event.group.id, group_event.event_id],
            )
        )
        assert data["data"]["event"]["issue_url"] == absolute_uri(
            f"/api/0/organizations/{self.organization.slug}/issues/{group_event.group.id}/"
        )
        assert data["data"]["event"]["issue_id"] == str(group_event.group.id)
        assert data["data"]["event"]["occurrence"] == convert_dict_key_case(
            occurrence.to_dict(), snake_to_camel_case
        )
        assert kwargs["headers"].keys() >= {
            "Content-Type",
            "Request-ID",
            "Sentry-Hook-Resource",
            "Sentry-Hook-Timestamp",
            "Sentry-Hook-Signature",
        }

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "event_alert.triggered"

        # SLO validation
        assert_success_metric(mock_record=mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponse404)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_alert_event_with_3p_failure(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        group_event = GroupEvent.from_event(event, event.group)
        settings = [
            {"name": "alert_prefix", "value": "[Not Good]"},
            {"name": "channel", "value": "#ignored-errors"},
            {"name": "best_emoji", "value": ":fire:"},
            {"name": "teamId", "value": 1},
            {"name": "assigneeId", "value": 3},
        ]

        rule_future = RuleFuture(
            rule=self.rule,
            kwargs={"sentry_app": self.sentry_app, "schema_defined_settings": settings},
        )

        with self.tasks():
            notify_sentry_app(group_event, [rule_future])

        ((args, kwargs),) = safe_urlopen.call_args_list
        payload = json.loads(kwargs["data"])

        assert payload["action"] == "triggered"
        assert payload["data"]["triggered_rule"] == self.rule.label
        assert payload["data"]["issue_alert"] == {
            "id": self.rule.id,
            "title": self.rule.label,
            "sentry_app_id": self.sentry_app.id,
            "settings": settings,
        }

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["event_type"] == "event_alert.triggered"

        # SLO validation
        assert_success_metric(mock_record=mock_record)
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.GOT_CLIENT_ERROR}_{404}",
        )
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )


@patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
class TestProcessResourceChange(TestCase):
    def setUp(self) -> None:
        self.sentry_app = self.create_sentry_app(
            organization=self.organization, events=["issue.created"]
        )

        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_group_created_sends_webhook(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        ((args, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])

        assert data["action"] == "created"
        assert data["installation"]["uuid"] == self.install.uuid
        assert data["data"]["issue"]["id"] == str(event.group.id)
        assert kwargs["headers"].keys() >= {
            "Content-Type",
            "Request-ID",
            "Sentry-Hook-Resource",
            "Sentry-Hook-Timestamp",
            "Sentry-Hook-Signature",
        }
        assert_success_metric(mock_record)

        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=4
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=4
        )

    @patch("sentry_sdk.capture_exception")
    def test_ignores_restricted_ip_error(
        self, capture_exception: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        safe_urlopen.side_effect = RestrictedIPAddress("12.8391.231")

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        # The task should complete without retrying when RestrictedIPAddress is raised
        # because it's in the ignore list of the retry decorator
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # Verify that the exception was not captured by Sentry since it's ignored
        assert len(capture_exception.mock_calls) == 0
        assert safe_urlopen.called

    @patch("sentry_sdk.capture_exception")
    def test_ignores_timeout_error(
        self, capture_exception: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        safe_urlopen.side_effect = Timeout()

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        # The task should complete without reporting to sentry when Timeout is raised
        # because it's in the on_silent list of the retry decorator
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # Verify that the exception was not captured by Sentry since it's on_silent
        assert len(capture_exception.mock_calls) == 0
        assert safe_urlopen.called

    @patch("sentry_sdk.capture_exception")
    def test_ignores_api_host_error(
        self, capture_exception: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        safe_urlopen.return_value = MockResponse503

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        # The task should complete without reporting to sentry when ApiHostError is raised
        # because it's in the on_silent list of the retry decorator
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # Verify that the exception was not captured by Sentry since it's on_silent
        assert len(capture_exception.mock_calls) == 0
        assert safe_urlopen.called

    @patch("sentry_sdk.capture_exception")
    def test_ignores_api_timeout_error(
        self, capture_exception: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        safe_urlopen.return_value = MockResponse504

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        # The task should complete without reporting to sentry when ApiTimeoutError is raised
        # because it's in the on_silent list of the retry decorator
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # Verify that the exception was not captured by Sentry since it's on_silent
        assert len(capture_exception.mock_calls) == 0
        assert safe_urlopen.called

    @patch("sentry_sdk.capture_exception")
    def test_ignores_connection_error(
        self, capture_exception: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        safe_urlopen.side_effect = ConnectionError()

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        # The task should complete without reporting to sentry when ConnectionError is raised
        # because it's in the on_silent list of the retry decorator
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # Verify that the exception was not captured by Sentry since it's on_silent
        assert len(capture_exception.mock_calls) == 0
        assert safe_urlopen.called

    @patch("sentry_sdk.capture_exception")
    def test_ignores_http_error(
        self, capture_exception: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        safe_urlopen.return_value = MockResponse502

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        # The task should complete without reporting to sentry when HTTPError is raised
        # because it's in the on_silent list of the retry decorator
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # Verify that the exception was not captured by Sentry since it's on_silent
        assert len(capture_exception.mock_calls) == 0
        assert safe_urlopen.called

    @patch("sentry_sdk.capture_exception")
    def test_silently_retries_chunked_encoding_error_unpublished(
        self, capture_exception, safe_urlopen
    ):
        """
        Test that a chunked encoding error is ignored when the sentry app is unpublished
        """
        with assume_test_silo_mode_of(SentryApp):
            SentryApp.objects.all().delete()
            SentryAppInstallation.objects.all().delete()

        self.sentry_app = self.create_sentry_app(
            organization=self.organization, events=["issue.created"]
        )
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

        safe_urlopen.side_effect = ChunkedEncodingError("Connection reset by peer")

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(capture_exception.mock_calls) == 0
        assert safe_urlopen.call_count == 1

    @patch("sentry_sdk.capture_exception")
    def test_silently_retries_chunked_encoding_error_published(
        self, capture_exception, safe_urlopen
    ):
        """
        Test that a chunked encoding error raises a retry error
        """
        with assume_test_silo_mode_of(SentryApp):
            SentryApp.objects.all().delete()
            SentryAppInstallation.objects.all().delete()

        self.sentry_app = self.create_sentry_app(
            organization=self.organization, published=True, events=["issue.created"]
        )
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

        safe_urlopen.side_effect = ChunkedEncodingError("Connection reset by peer")

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # Just 1 from the RetryError
        assert len(capture_exception.mock_calls) == 1

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_does_not_process_no_event(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        process_resource_change_bound(
            action="created", sender="Error", instance_id=123, project_id=1, group_id=1
        )
        assert len(safe_urlopen.mock_calls) == 0

        assert_failure_metric(
            mock_record, SentryAppSentryError(message=SentryAppWebhookFailureReason.MISSING_EVENT)
        )
        # PREPARE_WEBHOOK (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_does_not_process_disallowed_event(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        process_resource_change_bound("delete", "Group", self.create_group().id)
        assert len(safe_urlopen.mock_calls) == 0

        # We got an invalid event prior to lifecycle starting so we would exit early
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=0
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_does_not_process_sentry_apps_without_issue_webhooks(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        with assume_test_silo_mode_of(SentryApp):
            SentryAppInstallation.objects.all().delete()
            SentryApp.objects.all().delete()

        # DOES NOT subscribe to Issue events
        self.create_sentry_app_installation(organization=self.organization)

        process_resource_change_bound("created", "Group", self.create_group().id)

        assert len(safe_urlopen.mock_calls) == 0
        assert_success_metric(mock_record)

        # APP_CREATE (success) -> UPDATE_WEBHOOK (success) -> GRANT_EXCHANGER (success) -> PREPARE_WEBHOOK (success)
        # Our SentryAppInstallation test fixture automatically runs GrantExchanger to get a valid token
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=4
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=4
        )

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_error_created_sends_webhook(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        sentry_app = self.create_sentry_app(
            organization=self.project.organization, events=["error.created"]
        )
        install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=sentry_app.slug
        )

        one_min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "oh no"},
                "level": "error",
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.tasks():
            post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        ((args, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])

        assert data["action"] == "created"
        assert data["installation"]["uuid"] == install.uuid
        assert data["data"]["error"]["event_id"] == event.event_id
        assert data["data"]["error"]["issue_id"] == str(event.group_id)
        assert kwargs["headers"].keys() >= {
            "Content-Type",
            "Request-ID",
            "Sentry-Hook-Resource",
            "Sentry-Hook-Timestamp",
            "Sentry-Hook-Signature",
        }

        assert_success_metric(mock_record)

        # APP_CREATE (success) -> UPDATE_WEBHOOK (success) -> GRANT_EXCHANGER (success) -> PREPARE_WEBHOOK (success) ->
        # SEND_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=7
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=7
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_project_filter_no_filters_sends_webhook(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        create_or_update_service_hooks_for_installation(
            installation=self.install,
            webhook_url=self.sentry_app.webhook_url,
            events=self.sentry_app.events,
        )

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert safe_urlopen.called
        ((args, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])
        assert data["action"] == "created"
        assert data["installation"]["uuid"] == self.install.uuid
        assert data["data"]["issue"]["id"] == str(event.group.id)

        # SLO assertions
        assert_success_metric(mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success) SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=4
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=4
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_project_filter_matches_project_sends_webhook(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        with assume_test_silo_mode_of(ServiceHookProject):
            ServiceHookProject.objects.all().delete()
            ServiceHook.objects.all().delete()

        self.create_service_hook(
            project_ids=[self.project.id],  # matches project of issue
            installation=self.install,
            application=self.sentry_app,
            events=["issue.created"],
            org=self.organization,
            actor=self.install,
        )

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert safe_urlopen.called
        ((args, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])
        issue_data = data["data"]["issue"]
        assert data["action"] == "created"
        assert data["installation"]["uuid"] == self.install.uuid
        assert issue_data["id"] == str(event.group.id)
        assert (
            issue_data["url"]
            == f"http://testserver/api/0/organizations/{self.organization.slug}/issues/{event.group.id}/"
        )
        assert (
            issue_data["web_url"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/{event.group.id}/"
        )
        assert (
            issue_data["project_url"]
            == f"http://testserver/organizations/{self.organization.slug}/issues/?project={event.project_id}"
        )
        # SLO assertions
        assert_success_metric(mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=4
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=4
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_project_filter_no_match_does_not_send_webhook(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        with assume_test_silo_mode_of(ServiceHookProject):
            ServiceHookProject.objects.all().delete()
            ServiceHook.objects.all().delete()

        project_2 = self.create_project(
            name="Bar2", slug="bar2", teams=[self.team], fire_project_created=False
        )

        self.create_service_hook(
            project_ids=[project_2.id],  # no match
            installation=self.install,
            application=self.sentry_app,
            events=["issue.created"],
            org=self.organization,
            actor=self.install,
        )

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert not safe_urlopen.called

        # SLO assertions
        assert_success_metric(mock_record)
        # PREPARE_WEBHOOK (success)
        # Did not send a webhook bc per-project filter on project_id 2 and post_process was for project_id 1
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    # TODO(nola): Enable this test whenever we prevent infinite loops w/ error.created integrations
    @pytest.mark.skip(reason="enable this when/if we do prevent infinite error.created loops")
    @with_feature("organizations:integrations-event-hooks")
    def test_integration_org_error_created_doesnt_send_webhook(
        self, safe_urlopen: MagicMock
    ) -> None:
        sentry_app = self.create_sentry_app(
            organization=self.project.organization, events=["error.created"]
        )
        self.create_sentry_app_installation(
            organization=self.project.organization, slug=sentry_app.slug
        )

        one_min_ago = before_now(minutes=1)
        event = self.store_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "oh no"},
                "level": "error",
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.tasks():
            post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert not safe_urlopen.called


class TestSendResourceChangeWebhook(TestCase):
    def setUp(self) -> None:
        pass

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponse404)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @with_feature("organizations:integrations-event-hooks")
    def test_sends_webhooks_to_all_installs(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        self.project = self.create_project()
        self.sentry_app_1 = self.create_sentry_app(
            organization=self.project.organization,
            events=["issue.created"],
            webhook_url="https://google.com",
        )
        self.install_1 = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app_1.slug
        )
        self.sentry_app_2 = self.create_sentry_app(
            organization=self.project.organization,
            events=["issue.created"],
            webhook_url="https://apple.com",
        )
        self.install_2 = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=self.sentry_app_2.slug,
        )

        one_min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "oh no"},
                "level": "error",
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponse404)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @with_feature("organizations:integrations-event-hooks")
    def test_record_lifecycle_error_from_pubished_apps(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        self.project = self.create_project()
        self.sentry_app_1 = self.create_sentry_app(
            organization=self.project.organization,
            events=["issue.created"],
            webhook_url="https://google.com",
            published=True,
        )
        self.install_1 = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app_1.slug
        )
        self.sentry_app_2 = self.create_sentry_app(
            organization=self.project.organization,
            events=["issue.created"],
            webhook_url="https://apple.com",
        )
        self.install_2 = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=self.sentry_app_2.slug,
        )

        one_min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "oh no"},
                "level": "error",
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(safe_urlopen.mock_calls) == 2
        call_urls = [call.kwargs["url"] for call in safe_urlopen.mock_calls]
        assert self.sentry_app_1.webhook_url in call_urls
        assert self.sentry_app_2.webhook_url in call_urls

        # APP_CREATE (success) x 2 -> UPDATE_WEBHOOK (success) x2 -> GRANT_EXCHANGER (success) x 2 -> PREPARE_WEBHOOK (success)
        # -> SEND_WEBHOOK (success) x2 -> SEND_WEBHOOK (success) x2 -> SEND_WEBHOOK (halt) x2
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=13
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=11
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=2
        )
        assert_many_halt_metrics(
            mock_record,
            [
                f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.GOT_CLIENT_ERROR}_404",
                f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.GOT_CLIENT_ERROR}_404",
            ],
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @with_feature("organizations:integrations-event-hooks")
    def test_sends_webhooks_to_all_installs_success(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        self.project = self.create_project()
        self.sentry_app_1 = self.create_sentry_app(
            organization=self.project.organization,
            events=["issue.created"],
            webhook_url="https://google.com",
        )
        self.install_1 = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app_1.slug
        )
        self.sentry_app_2 = self.create_sentry_app(
            organization=self.project.organization,
            events=["issue.created"],
            webhook_url="https://apple.com",
        )
        self.install_2 = self.create_sentry_app_installation(
            organization=self.project.organization,
            slug=self.sentry_app_2.slug,
        )

        one_min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "oh no"},
                "level": "error",
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(safe_urlopen.mock_calls) == 2
        call_urls = [call.kwargs["url"] for call in safe_urlopen.mock_calls]
        assert self.sentry_app_1.webhook_url in call_urls
        assert self.sentry_app_2.webhook_url in call_urls

        assert_success_metric(mock_record)
        # APP_CREATE (success) x 2 -> UPDATE_WEBHOOK (success) x2 -> GRANT_EXCHANGER (success) x 2 -> PREPARE_WEBHOOK (success)
        # -> SEND_WEBHOOK (success) x 2 -> SEND_WEBHOOK (success) x2 -> SEND_WEBHOOK (success) x2
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=13
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=13
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @with_feature("organizations:integrations-event-hooks")
    def test_sends_webhooks_with_send_webhook_sentry_failure(self, mock_record: MagicMock) -> None:

        self.project = self.create_project()
        self.sentry_app_1 = self.create_sentry_app(
            organization=self.project.organization,
            events=["issue.created"],
            webhook_url="https://google.com",
        )
        self.install_1 = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app_1.slug
        )
        with assume_test_silo_mode_of(ServiceHook):
            servicehook = ServiceHook.objects.get(
                organization_id=self.install_1.organization_id, actor_id=self.install_1.id
            )
            servicehook.events = []
            servicehook.save()

        one_min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "oh no"},
                "level": "error",
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert_success_metric(mock_record)
        assert_failure_metric(
            mock_record, SentryAppSentryError(SentryAppWebhookFailureReason.EVENT_NOT_IN_SERVCEHOOK)
        )
        # APP_CREATE (success) -> UPDATE_WEBHOOK (success) -> GRANT_EXCHANGER (success) -> PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) x 1 -> SEND_WEBHOOK (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=6
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=5
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )


@control_silo_test
class TestInstallationWebhook(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()
        self.user = self.create_user()
        self.rpc_user = user_service.get_user(user_id=self.user.id)

        self.sentry_app = self.create_sentry_app(organization=self.project.organization)

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app.slug
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sends_installation_notification(self, mock_record: MagicMock) -> None:
        responses.add(responses.POST, "https://example.com/webhook")
        installation_webhook(self.install.id, self.user.id)

        response_body = json.loads(responses.calls[0].request.body)
        assert response_body.get("installation").get("uuid") == self.install.uuid
        assert response_body.get("action") == "created"
        assert self.rpc_user, "User should exist in test to test installation webhook unless noted"
        assert response_body.get("actor")["id"] == self.rpc_user.id

        # SLO assertions
        assert_success_metric(mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) x 1
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=2
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_gracefully_handles_missing_install(self, mock_record: MagicMock) -> None:
        responses.add(responses.POST, "https://example.com/webhook")

        installation_webhook(999, self.user.id)
        assert len(responses.calls) == 0

        # SLO assertions
        assert_failure_metric(
            mock_record,
            SentryAppSentryError(message=SentryAppWebhookFailureReason.MISSING_INSTALLATION),
        )
        # PREPARE_WEBHOOK (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_gracefully_handles_missing_user(self, mock_record: MagicMock) -> None:
        responses.add(responses.POST, "https://example.com/webhook")

        installation_webhook(self.install.id, 999)
        assert len(responses.calls) == 0

        # SLO assertions
        assert_failure_metric(
            mock_record,
            SentryAppSentryError(message=SentryAppWebhookFailureReason.MISSING_USER),
        )
        # PREPARE_WEBHOOK (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )


@patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
class TestCommentWebhook(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()
        self.user = self.create_user()

        self.sentry_app = self.create_sentry_app(
            organization=self.project.organization,
            events=["comment.updated", "comment.created", "comment.deleted"],
        )

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app.slug
        )

        self.issue = self.create_group(project=self.project)

        self.note = Activity.objects.create(
            group=self.issue,
            project=self.project,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "hello world"},
        )
        self.data = {
            "comment_id": self.note.id,
            "timestamp": self.note.datetime.isoformat(),
            "comment": self.note.data["text"],
            "project_slug": self.note.project.slug,
        }

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sends_comment_created_webhook(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        build_comment_webhook(
            self.install.id, self.issue.id, "comment.created", self.user.id, data=self.data
        )

        ((_, kwargs),) = safe_urlopen.call_args_list
        assert kwargs["url"] == self.sentry_app.webhook_url
        assert kwargs["headers"]["Sentry-Hook-Resource"] == "comment"
        data = json.loads(kwargs["data"])
        assert data["action"] == "created"
        assert data["data"]["issue_id"] == self.issue.id

        # SLO assertions
        assert_success_metric(mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=3
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=3
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sends_comment_updated_webhook(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        self.data.update(data={"text": "goodbye world"})
        build_comment_webhook(
            self.install.id, self.issue.id, "comment.updated", self.user.id, data=self.data
        )

        ((_, kwargs),) = safe_urlopen.call_args_list
        assert kwargs["url"] == self.sentry_app.webhook_url
        assert kwargs["headers"]["Sentry-Hook-Resource"] == "comment"
        data = json.loads(kwargs["data"])
        assert data["action"] == "updated"
        assert data["data"]["issue_id"] == self.issue.id

        # SLO assertions
        assert_success_metric(mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=3
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=3
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sends_comment_deleted_webhook(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        self.note.delete()
        build_comment_webhook(
            self.install.id, self.issue.id, "comment.deleted", self.user.id, data=self.data
        )

        ((_, kwargs),) = safe_urlopen.call_args_list
        assert kwargs["url"] == self.sentry_app.webhook_url
        assert kwargs["headers"]["Sentry-Hook-Resource"] == "comment"
        data = json.loads(kwargs["data"])
        assert data["action"] == "deleted"
        assert data["data"]["issue_id"] == self.issue.id

        # SLO assertions
        assert_success_metric(mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=3
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=3
        )


@patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
class TestWorkflowNotification(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()
        self.user = self.create_user()

        self.sentry_app = self.create_sentry_app(
            organization=self.project.organization,
            events=["issue.resolved", "issue.ignored", "issue.assigned"],
        )

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app.slug
        )

        self.issue = self.create_group(project=self.project)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sends_resolved_webhook(self, mock_record: MagicMock, safe_urlopen: MagicMock) -> None:
        workflow_notification(self.install.id, self.issue.id, "resolved", self.user.id)

        ((_, kwargs),) = safe_urlopen.call_args_list
        assert kwargs["url"] == self.sentry_app.webhook_url
        assert kwargs["headers"]["Sentry-Hook-Resource"] == "issue"
        data = json.loads(kwargs["data"])
        assert data["action"] == "resolved"
        assert data["data"]["issue"]["id"] == str(self.issue.id)

        # SLO assertions
        assert_success_metric(mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=3
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=3
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sends_resolved_webhook_as_Sentry_without_user(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        workflow_notification(self.install.id, self.issue.id, "resolved", None)

        ((_, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])
        assert data["actor"]["type"] == "application"
        assert data["actor"]["id"] == "sentry"
        assert data["actor"]["name"] == "Sentry"

        # SLO assertions
        assert_success_metric(mock_record)
        # PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (success) -> SEND_WEBHOOK (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=3
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=3
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_does_not_send_if_no_service_hook_exists(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        sentry_app = self.create_sentry_app(
            name="Another App", organization=self.project.organization, events=[]
        )
        install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=sentry_app.slug
        )
        workflow_notification(install.id, self.issue.id, "assigned", self.user.id)
        assert not safe_urlopen.called

        # SLO assertions
        assert_failure_metric(
            mock_record, SentryAppSentryError(SentryAppWebhookFailureReason.MISSING_SERVICEHOOK)
        )
        # APP_CREATE (success) -> UPDATE_WEBHOOK (success) -> GRANT_EXCHANGER (success) -> PREPARE_WEBHOOK (success) -> send_webhook (error)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=5
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=4
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_does_not_send_if_event_not_in_app_events(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        sentry_app = self.create_sentry_app(
            name="Another App",
            organization=self.project.organization,
            events=["issue.resolved", "issue.ignored"],
        )
        install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=sentry_app.slug
        )
        workflow_notification(install.id, self.issue.id, "assigned", self.user.id)
        assert not safe_urlopen.called

        # SLO assertions
        assert_failure_metric(
            mock_record, SentryAppSentryError(SentryAppWebhookFailureReason.EVENT_NOT_IN_SERVCEHOOK)
        )
        # APP_CREATE (success) -> UPDATE_WEBHOOK (success) -> GRANT_EXCHANGER (success) -> PREPARE_WEBHOOK (success) -> SEND_WEBHOOK (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=5
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=4
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )


class TestWebhookRequests(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user, id=1)
        self.sentry_app = self.create_sentry_app(
            name="Test App",
            organization=self.organization,
            events=["issue.resolved", "issue.ignored", "issue.assigned"],
            webhook_url="https://example.com",
        )
        with assume_test_silo_mode_of(SentryApp):
            self.sentry_app.update(status=SentryAppStatus.PUBLISHED)

        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )
        self.issue = self.create_group(project=self.project)
        self.buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)

    @patch(
        "sentry.utils.sentry_apps.webhooks.safe_urlopen",
        return_value=MockResponseWithHeadersInstance,
    )
    def test_saves_error_event_id_if_in_header(self, safe_urlopen: MagicMock) -> None:
        data = {"issue": serialize(self.issue)}
        with pytest.raises(ClientError):
            send_webhooks(
                installation=self.install, event="issue.assigned", data=data, actor=self.user
            )

        requests = self.buffer.get_requests()
        first_request = requests[0]

        assert safe_urlopen.called
        assert len(requests) == 1
        assert first_request["response_code"] == 400
        assert first_request["event_type"] == "issue.assigned"
        assert first_request["organization_id"] == self.install.organization_id
        assert first_request["error_id"] == "d5111da2c28645c5889d072017e3445d"
        assert first_request["project_id"] == "1"


@patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
class TestExpandedSentryAppsWebhooks(TestCase):
    def setUp(self) -> None:
        self.sentry_app = self.create_sentry_app(
            organization=self.organization, events=["issue.created"]
        )
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_cron_issue_without_feature_flag(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        """Test that CRON issues don't send webhooks without the feature flag"""
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "monitor check-in failure",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        # Set to CRON category (type_id = 4001, MonitorIncidentType)
        with assume_test_silo_mode(SiloMode.REGION):
            event.group.update(type=4001)

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Generic.value,
            )

        assert not safe_urlopen.called

    @with_feature("organizations:expanded-sentry-apps-webhooks")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_cron_issue_with_feature_flag(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        event = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "monitor check-in failure",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None
        with assume_test_silo_mode(SiloMode.REGION):
            event.group.update(type=4001)

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Generic.value,
            )

        assert safe_urlopen.called
        ((args, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])
        assert data["action"] == "created"
        assert data["installation"]["uuid"] == self.install.uuid
        assert data["data"]["issue"]["id"] == str(event.group.id)

        assert_success_metric(mock_record)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_error_issue_always_sends_webhook(
        self, mock_record: MagicMock, safe_urlopen: MagicMock
    ) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert safe_urlopen.called
        ((args, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])

        assert data["action"] == "created"
        assert data["installation"]["uuid"] == self.install.uuid
        assert data["data"]["issue"]["id"] == str(event.group.id)
        assert_success_metric(mock_record)


class TestBackfillServiceHooksEvents(TestCase):
    def setUp(self) -> None:
        self.sentry_app = self.create_sentry_app(
            name="Test App",
            webhook_url="https://example.com",
            organization=self.organization,
            events=["issue.created", "issue.resolved", "error.created"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    def test_regenerate_service_hook_for_installation_success(self):
        with assume_test_silo_mode(SiloMode.REGION):
            hook = ServiceHook.objects.get(installation_id=self.install.id)
            hook.events = ["issue.resolved", "error.created"]
            hook.save()

        with self.tasks(), assume_test_silo_mode(SiloMode.CONTROL):
            regenerate_service_hooks_for_installation(
                installation_id=self.install.id,
                webhook_url=self.sentry_app.webhook_url,
                events=self.sentry_app.events,
            )

        with assume_test_silo_mode(SiloMode.REGION):
            hook.refresh_from_db()
            assert set(hook.events) == {"issue.created", "issue.resolved", "error.created"}

    def test_regenerate_service_hook_for_installation_event_not_in_app_events(self):
        with self.tasks(), assume_test_silo_mode(SiloMode.CONTROL):
            regenerate_service_hooks_for_installation(
                installation_id=self.install.id,
                webhook_url=self.sentry_app.webhook_url,
                events=self.sentry_app.events,
            )

        with assume_test_silo_mode(SiloMode.REGION):
            hook = ServiceHook.objects.get(installation_id=self.install.id)
            assert set(hook.events) == {"issue.created", "issue.resolved", "error.created"}

    def test_regenerate_service_hook_for_installation_with_empty_app_events(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.sentry_app.update(events=[])
            assert self.sentry_app.events == []

        with assume_test_silo_mode(SiloMode.REGION):
            hook = ServiceHook.objects.get(installation_id=self.install.id)
            assert hook.events != []

        with self.tasks(), assume_test_silo_mode(SiloMode.CONTROL):
            regenerate_service_hooks_for_installation(
                installation_id=self.install.id,
                webhook_url=self.sentry_app.webhook_url,
                events=self.sentry_app.events,
            )

        with assume_test_silo_mode(SiloMode.REGION):
            hook.refresh_from_db()
            assert hook.events == []
