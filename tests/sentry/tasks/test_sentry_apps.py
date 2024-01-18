from collections import namedtuple
from datetime import datetime, timedelta
from unittest.mock import ANY, patch

import pytest
from celery import Task
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from requests.exceptions import Timeout

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.constants import SentryAppStatus
from sentry.integrations.notify_disable import notify_disable
from sentry.integrations.request_buffer import IntegrationRequestBuffer
from sentry.models.activity import Activity
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.group import Group
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.integrations.utils import get_redis_key
from sentry.models.rule import Rule
from sentry.models.sentryfunction import SentryFunction
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.shared_integrations.exceptions import ClientError
from sentry.tasks.post_process import post_process_group
from sentry.tasks.sentry_apps import (
    build_comment_webhook,
    installation_webhook,
    notify_sentry_app,
    process_resource_change_bound,
    send_alert_event,
    send_webhooks,
    workflow_notification,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.rules import RuleFuture
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer

pytestmark = [requires_snuba]


def raiseStatusFalse():
    return False


def raiseStatusTrue():
    return True


def raiseException():
    raise Exception


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
MockResponseInstance = MockResponse({}, {}, "", True, 200, raiseStatusFalse, None)
MockResponse404 = MockResponse({}, {}, "", False, 404, raiseException, None)


@region_silo_test
class TestSendAlertEvent(TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.rule = Rule.objects.create(project=self.project, label="Issa Rule")
        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_no_sentry_app(self, safe_urlopen):
        event = self.store_event(data={}, project_id=self.project.id)
        send_alert_event(event, self.rule, 9999)

        assert not safe_urlopen.called

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_no_sentry_app_in_future(self, safe_urlopen):
        event = self.store_event(data={}, project_id=self.project.id)
        rule_future = RuleFuture(rule=self.rule, kwargs={})

        with self.tasks():
            notify_sentry_app(event, [rule_future])

        assert not safe_urlopen.called

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_no_installation(self, safe_urlopen):
        sentry_app = self.create_sentry_app(organization=self.organization)
        event = self.store_event(data={}, project_id=self.project.id)
        rule_future = RuleFuture(rule=self.rule, kwargs={"sentry_app": sentry_app})

        with self.tasks():
            notify_sentry_app(event, [rule_future])

        assert not safe_urlopen.called

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    def test_send_alert_event(self, safe_urlopen):
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        group = event.group
        rule_future = RuleFuture(rule=self.rule, kwargs={"sentry_app": self.sentry_app})

        with self.tasks():
            notify_sentry_app(event, [rule_future])

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
        assert data["data"]["event"]["event_id"] == event.event_id
        assert data["data"]["event"]["url"] == absolute_uri(
            reverse(
                "sentry-api-0-project-event-details",
                args=[self.organization.slug, self.project.slug, event.event_id],
            )
        )
        assert data["data"]["event"]["web_url"] == absolute_uri(
            reverse(
                "sentry-organization-event-detail",
                args=[self.organization.slug, group.id, event.event_id],
            )
        )
        assert data["data"]["event"]["issue_url"] == absolute_uri(f"/api/0/issues/{group.id}/")
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

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    def test_send_alert_event_with_additional_payload(self, safe_urlopen):
        event = self.store_event(data={}, project_id=self.project.id)
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
            notify_sentry_app(event, [rule_future])

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


@region_silo_test
@patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
class TestProcessResourceChange(TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app(
            organization=self.organization, events=["issue.created"]
        )

        self.install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

    def test_group_created_sends_webhook(self, safe_urlopen):
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
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

    def test_does_not_process_disallowed_event(self, safe_urlopen):
        process_resource_change_bound("delete", "Group", self.create_group().id)
        assert len(safe_urlopen.mock_calls) == 0

    def test_does_not_process_sentry_apps_without_issue_webhooks(self, safe_urlopen):
        with assume_test_silo_mode_of(SentryApp):
            SentryAppInstallation.objects.all().delete()
            SentryApp.objects.all().delete()

        # DOES NOT subscribe to Issue events
        self.create_sentry_app_installation(organization=self.organization)

        process_resource_change_bound("created", "Group", self.create_group().id)

        assert len(safe_urlopen.mock_calls) == 0

    @patch("sentry.tasks.sentry_apps._process_resource_change")
    def test_process_resource_change_bound_passes_retry_object(self, process, safe_urlopen):
        group = self.create_group(project=self.project)

        process_resource_change_bound("created", "Group", group.id)

        ((_, kwargs),) = process.call_args_list
        task = kwargs["retryer"]
        assert isinstance(task, Task)

    @with_feature("organizations:integrations-event-hooks")
    def test_error_created_sends_webhook(self, safe_urlopen):
        sentry_app = self.create_sentry_app(
            organization=self.project.organization, events=["error.created"]
        )
        install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=sentry_app.slug
        )

        one_min_ago = iso_format(before_now(minutes=1))
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

    # TODO(nola): Enable this test whenever we prevent infinite loops w/ error.created integrations
    @pytest.mark.skip(reason="enable this when/if we do prevent infinite error.created loops")
    @with_feature("organizations:integrations-event-hooks")
    def test_integration_org_error_created_doesnt_send_webhook(self, safe_urlopen):
        sentry_app = self.create_sentry_app(
            organization=self.project.organization, events=["error.created"]
        )
        self.create_sentry_app_installation(
            organization=self.project.organization, slug=sentry_app.slug
        )

        one_min_ago = iso_format(before_now(minutes=1))
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
            )

        assert not safe_urlopen.called


@region_silo_test
@patch("sentry.tasks.sentry_functions.send_sentry_function_webhook.delay")
class TestProcessResourceChangeSentryFunctions(TestCase):
    def setUp(self):
        self.sentryFunction = self.create_sentry_function(
            organization_id=self.organization.id,
            name="foo",
            author="bar",
            code="baz",
            overview="qux",
            events=["issue", "comment", "error"],
        )

    @with_feature("organizations:sentry-functions")
    def test_group_created_sends_webhook(self, send_sentry_function_webhook):
        event = self.store_event(data={}, project_id=self.project.id)
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
            )
        data = {}
        data["issue"] = serialize(Group.objects.get(id=event.group_id))
        send_sentry_function_webhook.assert_called_once_with(
            self.sentryFunction.external_id,
            "issue.created",
            data["issue"]["id"],
            data,
        )

    @with_feature("organizations:sentry-functions")
    def test_does_not_process_disallowed_event(self, send_sentry_function_webhook):
        process_resource_change_bound("delete", "Group", self.create_group().id)
        assert len(send_sentry_function_webhook.mock_calls) == 0

    @with_feature("organizations:sentry-functions")
    def test_does_not_process_sentry_apps_without_issue_webhooks(
        self, send_sentry_function_webhook
    ):
        SentryFunction.objects.all().delete()

        # DOES NOT subscribe to Issue events
        self.create_sentry_function(
            organization_id=self.organization.id,
            name="foo",
            author="bar",
            code="baz",
            overview="qux",
            events=["comment", "error"],
        )

        process_resource_change_bound("created", "Group", self.create_group().id)

        assert len(send_sentry_function_webhook.mock_calls) == 0

    @with_feature("organizations:sentry-functions")
    def test_error_created_does_not_sends_webhook(self, send_sentry_function_webhook):
        one_min_ago = iso_format(before_now(minutes=1))
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
            )

        assert len(send_sentry_function_webhook.mock_calls) == 0


@region_silo_test
class TestSendResourceChangeWebhook(TestCase):
    def setUp(self):
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

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponse404)
    @with_feature("organizations:integrations-event-hooks")
    def test_sends_webhooks_to_all_installs(self, safe_urlopen):
        one_min_ago = iso_format(before_now(minutes=1))
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
            )

        assert len(safe_urlopen.mock_calls) == 2
        call_urls = [call.kwargs["url"] for call in safe_urlopen.mock_calls]
        assert self.sentry_app_1.webhook_url in call_urls
        assert self.sentry_app_2.webhook_url in call_urls


@control_silo_test
@patch("sentry.mediators.sentry_app_installations.InstallationNotifier.run")
class TestInstallationWebhook(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.user = self.create_user()
        self.rpc_user = user_service.get_user(user_id=self.user.id)

        self.sentry_app = self.create_sentry_app(organization=self.project.organization)

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app.slug
        )

    def test_sends_installation_notification(self, run):
        installation_webhook(self.install.id, self.user.id)

        run.assert_called_with(install=self.install, user=self.rpc_user, action="created")

    def test_gracefully_handles_missing_install(self, run):
        installation_webhook(999, self.user.id)
        assert len(run.mock_calls) == 0

    def test_gracefully_handles_missing_user(self, run):
        installation_webhook(self.install.id, 999)
        assert len(run.mock_calls) == 0


@region_silo_test
@patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
class TestCommentWebhook(TestCase):
    def setUp(self):
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
            "timestamp": self.note.datetime,
            "comment": self.note.data.get("text"),
            "project_slug": self.note.project.slug,
        }

    def test_sends_comment_created_webhook(self, safe_urlopen):
        build_comment_webhook(
            self.install.id, self.issue.id, "comment.created", self.user.id, data=self.data
        )

        ((_, kwargs),) = safe_urlopen.call_args_list
        assert kwargs["url"] == self.sentry_app.webhook_url
        assert kwargs["headers"]["Sentry-Hook-Resource"] == "comment"
        data = json.loads(kwargs["data"])
        assert data["action"] == "created"
        assert data["data"]["issue_id"] == self.issue.id

    def test_sends_comment_updated_webhook(self, safe_urlopen):
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

    def test_sends_comment_deleted_webhook(self, safe_urlopen):
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


@region_silo_test
@patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
class TestWorkflowNotification(TestCase):
    def setUp(self):
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

    def test_sends_resolved_webhook(self, safe_urlopen):
        workflow_notification(self.install.id, self.issue.id, "resolved", self.user.id)

        ((_, kwargs),) = safe_urlopen.call_args_list
        assert kwargs["url"] == self.sentry_app.webhook_url
        assert kwargs["headers"]["Sentry-Hook-Resource"] == "issue"
        data = json.loads(kwargs["data"])
        assert data["action"] == "resolved"
        assert data["data"]["issue"]["id"] == str(self.issue.id)

    def test_sends_resolved_webhook_as_Sentry_without_user(self, safe_urlopen):
        workflow_notification(self.install.id, self.issue.id, "resolved", None)

        ((_, kwargs),) = safe_urlopen.call_args_list
        data = json.loads(kwargs["data"])
        assert data["actor"]["type"] == "application"
        assert data["actor"]["id"] == "sentry"
        assert data["actor"]["name"] == "Sentry"

    def test_does_not_send_if_no_service_hook_exists(self, safe_urlopen):
        sentry_app = self.create_sentry_app(
            name="Another App", organization=self.project.organization, events=[]
        )
        install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=sentry_app.slug
        )
        workflow_notification(install.id, self.issue.id, "assigned", self.user.id)
        assert not safe_urlopen.called

    def test_does_not_send_if_event_not_in_app_events(self, safe_urlopen):
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


@region_silo_test
class TestWebhookRequests(TestCase):
    def setUp(self):
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
        self.integration_buffer = IntegrationRequestBuffer(
            get_redis_key(self.sentry_app, self.organization.id)
        )

    @patch(
        "sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockFailureResponseInstance
    )
    def test_saves_error_if_webhook_request_fails(self, safe_urlopen):
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
        assert self.integration_buffer._get_all_from_buffer() == []
        assert self.integration_buffer.is_integration_broken() is False

    @patch(
        "sentry.utils.sentry_apps.webhooks.safe_urlopen",
        return_value=MockFailureHTMLContentResponseInstance,
    )
    def test_saves_error_if_webhook_request_with_html_content_fails(self, safe_urlopen):
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
        assert first_request["response_body"] == html_content
        assert self.integration_buffer._get_all_from_buffer() == []
        assert self.integration_buffer.is_integration_broken() is False

    @patch(
        "sentry.utils.sentry_apps.webhooks.safe_urlopen",
        return_value=MockFailureJSONContentResponseInstance,
    )
    def test_saves_error_if_webhook_request_with_json_content_fails(self, safe_urlopen):
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
        assert json.loads(first_request["response_body"]) == json_content
        assert self.integration_buffer._get_all_from_buffer() == []
        assert self.integration_buffer.is_integration_broken() is False

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockResponseInstance)
    def test_saves_request_if_webhook_request_succeeds(self, safe_urlopen):
        data = {"issue": serialize(self.issue)}
        send_webhooks(installation=self.install, event="issue.assigned", data=data, actor=self.user)

        requests = self.buffer.get_requests()
        first_request = requests[0]

        assert safe_urlopen.called
        assert len(requests) == 1
        assert first_request["response_code"] == 200
        assert first_request["event_type"] == "issue.assigned"
        assert first_request["organization_id"] == self.install.organization_id
        assert self.integration_buffer._get_all_from_buffer() == []
        assert self.integration_buffer.is_integration_broken() is False

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", side_effect=Timeout)
    def test_saves_error_for_request_timeout(self, safe_urlopen):
        data = {"issue": serialize(self.issue)}
        # we don't log errors for unpublished and internal apps
        with pytest.raises(Timeout):
            send_webhooks(
                installation=self.install, event="issue.assigned", data=data, actor=self.user
            )

        requests = self.buffer.get_requests()
        first_request = requests[0]

        assert safe_urlopen.called
        assert len(requests) == 1
        assert first_request["response_code"] == 0
        assert first_request["event_type"] == "issue.assigned"
        assert first_request["organization_id"] == self.install.organization_id
        assert self.integration_buffer._get_all_from_buffer() == []
        assert self.integration_buffer.is_integration_broken() is False

    @patch(
        "sentry.utils.sentry_apps.webhooks.safe_urlopen",
        return_value=MockResponseWithHeadersInstance,
    )
    def test_saves_error_event_id_if_in_header(self, safe_urlopen):
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

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", side_effect=Timeout)
    def test_does_not_raise_error_if_unpublished(self, safe_urlopen):
        """
        Tests that buffer records when unpublished app has a timeout but error is not raised
        """
        with assume_test_silo_mode_of(SentryApp):
            self.sentry_app.update(status=SentryAppStatus.INTERNAL)
        events = self.sentry_app.events
        data = {"issue": serialize(self.issue)}
        # we don't raise errors for unpublished and internal apps
        send_webhooks(installation=self.install, event="issue.assigned", data=data, actor=self.user)

        requests = self.buffer.get_requests()

        assert safe_urlopen.called
        assert len(requests) == 1
        assert (self.integration_buffer._get_all_from_buffer()[0]["timeout_count"]) == "1"
        assert self.integration_buffer.is_integration_broken() is False
        self.sentry_app.refresh_from_db()  # reload to get updated events
        assert self.sentry_app.events == events  # check that events are the same / app is enabled

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", side_effect=Timeout)
    @override_settings(BROKEN_TIMEOUT_THRESHOLD=3)
    def test_timeout_disable(self, safe_urlopen):
        """
        Test that the integration is disabled after BROKEN_TIMEOUT_THRESHOLD number of timeouts
        """
        with assume_test_silo_mode_of(SentryApp):
            self.sentry_app.update(status=SentryAppStatus.INTERNAL)
        data = {"issue": serialize(self.issue)}
        # we don't raise errors for unpublished and internal apps
        for i in range(3):
            send_webhooks(
                installation=self.install, event="issue.assigned", data=data, actor=self.user
            )
        assert safe_urlopen.called
        assert [len(item) == 0 for item in self.integration_buffer._get_broken_range_from_buffer()]
        assert len(self.integration_buffer._get_all_from_buffer()) == 0
        self.sentry_app.refresh_from_db()  # reload to get updated events
        assert len(self.sentry_app.events) == 0  # check that events are empty / app is disabled

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen", side_effect=Timeout)
    @override_settings(BROKEN_TIMEOUT_THRESHOLD=3)
    def test_ignore_issue_alert(self, safe_urlopen):
        """
        Test that the integration is disabled after BROKEN_TIMEOUT_THRESHOLD number of timeouts
        """
        with assume_test_silo_mode_of(SentryApp):
            self.sentry_app.update(status=SentryAppStatus.INTERNAL)
        data = {"issue": serialize(self.issue)}
        # we don't raise errors for unpublished and internal apps
        for i in range(3):
            send_webhooks(
                installation=self.install, event="event.alert", data=data, actor=self.user
            )
        assert not safe_urlopen.called
        assert [len(item) == 0 for item in self.integration_buffer._get_broken_range_from_buffer()]
        assert len(self.integration_buffer._get_all_from_buffer()) == 0
        self.sentry_app.refresh_from_db()  # reload to get updated events
        assert len(self.sentry_app.events) == 3  # check we didn't disable the webhooks

    @patch(
        "sentry.utils.sentry_apps.webhooks.safe_urlopen", return_value=MockFailureResponseInstance
    )
    def test_slow_should_disable(self, safe_urlopen):
        """
        Tests that the integration is broken after 7 days of errors and disabled
        Slow shut off
        """
        with assume_test_silo_mode_of(SentryApp):
            self.sentry_app.update(status=SentryAppStatus.INTERNAL)
        data = {"issue": serialize(self.issue)}
        now = datetime.now() + timedelta(hours=1)
        for i in reversed(range(7)):
            with freeze_time(now - timedelta(days=i)):
                send_webhooks(
                    installation=self.install, event="issue.assigned", data=data, actor=self.user
                )

        # Flush audit logs
        with outbox_runner():
            pass

        assert safe_urlopen.called
        assert [len(item) == 0 for item in self.integration_buffer._get_broken_range_from_buffer()]
        self.sentry_app.refresh_from_db()  # reload to get updated events
        assert len(self.sentry_app.events) == 0  # check that events are empty / app is disabled
        assert len(self.integration_buffer._get_all_from_buffer()) == 0

        with assume_test_silo_mode_of(AuditLogEntry):
            assert AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("INTERNAL_INTEGRATION_DISABLED"),
                organization_id=self.organization.id,
            ).exists()

    def test_notify_disabled_email(self):
        with self.tasks():
            notify_disable(
                self.organization,
                self.sentry_app.name,
                get_redis_key(self.sentry_app, self.organization.id),
                self.sentry_app.slug,
                self.sentry_app.webhook_url,
            )
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.subject == f"Action required: Fix your {self.sentry_app.name} integration"
        assert (
            self.organization.absolute_url(
                f"/settings/{self.organization.slug}/developer-settings/{self.sentry_app.slug}"
            )
            in msg.body
        )
        assert (
            self.organization.absolute_url(
                f"/settings/{self.organization.slug}/developer-settings/{self.sentry_app.slug}/?referrer=disabled-sentry-app"
            )
            in msg.body
        )
        assert (
            self.organization.absolute_url(
                f"/settings/{self.organization.slug}/developer-settings/{self.sentry_app.slug}/dashboard"
            )
            in msg.body
        )
        assert (
            self.organization.absolute_url(
                f"/settings/{self.organization.slug}/developer-settings/{self.sentry_app.slug}/dashboard/?referrer=disabled-sentry-app/"
            )
            in msg.body
        )
        assert (self.sentry_app.webhook_url) in msg.body
