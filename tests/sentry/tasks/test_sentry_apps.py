from collections import namedtuple
from unittest.mock import patch

import pytest
from celery import Task
from django.urls import reverse
from requests.exceptions import Timeout

from sentry.api.serializers import serialize
from sentry.constants import SentryAppStatus
from sentry.models import Rule, SentryApp, SentryAppInstallation
from sentry.receivers.sentry_apps import *  # NOQA
from sentry.shared_integrations.exceptions import ClientError
from sentry.tasks.post_process import post_process_group
from sentry.tasks.sentry_apps import (
    installation_webhook,
    notify_sentry_app,
    process_resource_change_bound,
    send_alert_event,
    send_webhooks,
    workflow_notification,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.helpers.faux import faux
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.utils.sentryappwebhookrequests import SentryAppWebhookRequestsBuffer


def raiseStatuseFalse():
    return False


def raiseStatusTrue():
    return True


def raiseException():
    raise Exception


RuleFuture = namedtuple("RuleFuture", ["rule", "kwargs"])

MockResponse = namedtuple(
    "MockResponse", ["headers", "content", "text", "ok", "status_code", "raise_for_status"]
)
MockResponseInstance = MockResponse({}, {}, "", True, 200, raiseStatuseFalse)
MockFailureResponseInstance = MockResponse({}, {}, "", False, 400, raiseStatusTrue)
MockResponse404 = MockResponse({}, {}, "", False, 404, raiseException)
MockResponseWithHeadersInstance = MockResponse(
    {"Sentry-Hook-Error": "d5111da2c28645c5889d072017e3445d", "Sentry-Hook-Project": "1"},
    {},
    "",
    False,
    400,
    raiseStatusTrue,
)


class DictContaining:
    def __init__(self, *args, **kwargs):
        if len(args) == 1 and isinstance(args[0], dict):
            self.args = []
            self.kwargs = args[0]
        else:
            self.args = args
            self.kwargs = kwargs

    def __eq__(self, other):
        return self._args_match(other) and self._kwargs_match(other)

    def _args_match(self, other):
        for key in self.args:
            if key not in other:
                return False
        return True

    def _kwargs_match(self, other):
        for key, value in self.kwargs.items():
            if self.kwargs[key] != other[key]:
                return False
        return True


class TestSendAlertEvent(TestCase):
    def setUp(self):
        self.organization = self.create_organization(slug="foo")
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.project = self.create_project(organization=self.organization)
        self.rule = Rule.objects.create(project=self.project, label="Issa Rule")
        self.install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app.slug
        )

    @patch("sentry.tasks.sentry_apps.safe_urlopen")
    def test_no_sentry_app(self, safe_urlopen):
        event = self.store_event(data={}, project_id=self.project.id)
        send_alert_event(event, self.rule, 9999)

        assert not safe_urlopen.called

    @patch("sentry.tasks.sentry_apps.safe_urlopen")
    def test_no_sentry_app_in_future(self, safe_urlopen):
        event = self.store_event(data={}, project_id=self.project.id)
        rule_future = RuleFuture(rule=self.rule, kwargs={})

        with self.tasks():
            notify_sentry_app(event, [rule_future])

        assert not safe_urlopen.called

    @patch("sentry.tasks.sentry_apps.safe_urlopen")
    def test_no_installation(self, safe_urlopen):
        sentry_app = self.create_sentry_app(organization=self.organization)
        event = self.store_event(data={}, project_id=self.project.id)
        rule_future = RuleFuture(rule=self.rule, kwargs={"sentry_app": sentry_app})

        with self.tasks():
            notify_sentry_app(event, [rule_future])

        assert not safe_urlopen.called

    @patch("sentry.tasks.sentry_apps.safe_urlopen", return_value=MockResponseInstance)
    def test_send_alert_event(self, safe_urlopen):
        event = self.store_event(data={}, project_id=self.project.id)
        group = event.group
        rule_future = RuleFuture(rule=self.rule, kwargs={"sentry_app": self.sentry_app})

        with self.tasks():
            notify_sentry_app(event, [rule_future])

        data = json.loads(faux(safe_urlopen).kwargs["data"])

        assert data == {
            "action": "triggered",
            "installation": {"uuid": self.install.uuid},
            "data": {
                "event": DictContaining(
                    event_id=event.event_id,
                    url=absolute_uri(
                        reverse(
                            "sentry-api-0-project-event-details",
                            args=[self.organization.slug, self.project.slug, event.event_id],
                        )
                    ),
                    web_url=absolute_uri(
                        reverse(
                            "sentry-organization-event-detail",
                            args=[self.organization.slug, group.id, event.event_id],
                        )
                    ),
                    issue_url=absolute_uri(f"/api/0/issues/{group.id}/"),
                    issue_id=str(group.id),
                ),
                "triggered_rule": self.rule.label,
            },
            "actor": {"type": "application", "id": "sentry", "name": "Sentry"},
        }

        assert faux(safe_urlopen).kwarg_equals(
            "headers",
            DictContaining(
                "Content-Type",
                "Request-ID",
                "Sentry-Hook-Resource",
                "Sentry-Hook-Timestamp",
                "Sentry-Hook-Signature",
            ),
        )

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "event_alert.triggered"

    @patch("sentry.tasks.sentry_apps.safe_urlopen", return_value=MockResponseInstance)
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

        payload = json.loads(faux(safe_urlopen).kwargs["data"])

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


@patch("sentry.tasks.sentry_apps.safe_urlopen", return_value=MockResponseInstance)
class TestProcessResourceChange(TestCase):
    def setUp(self):
        self.project = self.create_project()

        self.sentry_app = self.create_sentry_app(
            organization=self.project.organization, events=["issue.created"]
        )

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app.slug
        )

    def test_group_created_sends_webhook(self, safe_urlopen):
        event = self.store_event(data={}, project_id=self.project.id)
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
            )

        data = json.loads(faux(safe_urlopen).kwargs["data"])

        assert data["action"] == "created"
        assert data["installation"]["uuid"] == self.install.uuid
        assert data["data"]["issue"]["id"] == str(event.group.id)
        assert faux(safe_urlopen).kwargs_contain("headers.Content-Type")
        assert faux(safe_urlopen).kwargs_contain("headers.Request-ID")
        assert faux(safe_urlopen).kwargs_contain("headers.Sentry-Hook-Resource")
        assert faux(safe_urlopen).kwargs_contain("headers.Sentry-Hook-Timestamp")
        assert faux(safe_urlopen).kwargs_contain("headers.Sentry-Hook-Signature")

    def test_does_not_process_disallowed_event(self, safe_urlopen):
        process_resource_change_bound("delete", "Group", self.create_group().id)
        assert len(safe_urlopen.mock_calls) == 0

    def test_does_not_process_sentry_apps_without_issue_webhooks(self, safe_urlopen):
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

        task = faux(process).kwargs["retryer"]
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

        data = json.loads(faux(safe_urlopen).kwargs["data"])

        assert data["action"] == "created"
        assert data["installation"]["uuid"] == install.uuid
        assert data["data"]["error"]["event_id"] == event.event_id
        assert data["data"]["error"]["issue_id"] == str(event.group_id)
        assert faux(safe_urlopen).kwargs_contain("headers.Content-Type")
        assert faux(safe_urlopen).kwargs_contain("headers.Request-ID")
        assert faux(safe_urlopen).kwargs_contain("headers.Sentry-Hook-Resource")
        assert faux(safe_urlopen).kwargs_contain("headers.Sentry-Hook-Timestamp")
        assert faux(safe_urlopen).kwargs_contain("headers.Sentry-Hook-Signature")

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

    @patch("sentry.tasks.sentry_apps.safe_urlopen", return_value=MockResponse404)
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


@patch("sentry.mediators.sentry_app_installations.InstallationNotifier.run")
class TestInstallationWebhook(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.user = self.create_user()

        self.sentry_app = self.create_sentry_app(organization=self.project.organization)

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app.slug
        )

    def test_sends_installation_notification(self, run):
        installation_webhook(self.install.id, self.user.id)

        run.assert_called_with(install=self.install, user=self.user, action="created")

    def test_gracefully_handles_missing_install(self, run):
        installation_webhook(999, self.user.id)
        assert len(run.mock_calls) == 0

    def test_gracefully_handles_missing_user(self, run):
        installation_webhook(self.install.id, 999)
        assert len(run.mock_calls) == 0


@patch("sentry.tasks.sentry_apps.safe_urlopen", return_value=MockResponseInstance)
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

        assert faux(safe_urlopen).kwarg_equals("url", self.sentry_app.webhook_url)
        assert faux(safe_urlopen).kwarg_equals("data.action", "resolved", format="json")
        assert faux(safe_urlopen).kwarg_equals("headers.Sentry-Hook-Resource", "issue")
        assert faux(safe_urlopen).kwarg_equals(
            "data.data.issue.id", str(self.issue.id), format="json"
        )

    def test_sends_resolved_webhook_as_Sentry_without_user(self, safe_urlopen):
        workflow_notification(self.install.id, self.issue.id, "resolved", None)

        assert faux(safe_urlopen).kwarg_equals("data.actor.type", "application", format="json")
        assert faux(safe_urlopen).kwarg_equals("data.actor.id", "sentry", format="json")
        assert faux(safe_urlopen).kwarg_equals("data.actor.name", "Sentry", format="json")

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


class TestWebhookRequests(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.user = self.create_user()

        self.sentry_app = self.create_sentry_app(
            name="Test App",
            organization=self.project.organization,
            events=["issue.resolved", "issue.ignored", "issue.assigned"],
        )
        self.sentry_app.update(status=SentryAppStatus.PUBLISHED)

        self.install = self.create_sentry_app_installation(
            organization=self.project.organization, slug=self.sentry_app.slug
        )

        self.issue = self.create_group(project=self.project)
        self.buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)

    @patch("sentry.tasks.sentry_apps.safe_urlopen", return_value=MockFailureResponseInstance)
    def test_saves_error_if_webhook_request_fails(self, safe_urlopen):
        data = {"issue": serialize(self.issue)}

        with self.assertRaises(ClientError):
            send_webhooks(
                installation=self.install, event="issue.assigned", data=data, actor=self.user
            )

        requests = self.buffer.get_requests()
        requests_count = len(requests)
        first_request = requests[0]

        assert safe_urlopen.called
        assert requests_count == 1
        assert first_request["response_code"] == 400
        assert first_request["event_type"] == "issue.assigned"
        assert first_request["organization_id"] == self.install.organization.id

    @patch("sentry.tasks.sentry_apps.safe_urlopen", return_value=MockResponseInstance)
    def test_saves_request_if_webhook_request_succeeds(self, safe_urlopen):
        data = {"issue": serialize(self.issue)}
        send_webhooks(installation=self.install, event="issue.assigned", data=data, actor=self.user)

        requests = self.buffer.get_requests()
        requests_count = len(requests)
        first_request = requests[0]

        assert safe_urlopen.called
        assert requests_count == 1
        assert first_request["response_code"] == 200
        assert first_request["event_type"] == "issue.assigned"
        assert first_request["organization_id"] == self.install.organization.id

    @patch("sentry.tasks.sentry_apps.safe_urlopen", side_effect=Timeout)
    def test_saves_error_for_request_timeout(self, safe_urlopen):
        data = {"issue": serialize(self.issue)}
        # we don't log errors for unpublished and internal apps
        with self.assertRaises(Timeout):
            send_webhooks(
                installation=self.install, event="issue.assigned", data=data, actor=self.user
            )

        requests = self.buffer.get_requests()
        requests_count = len(requests)
        first_request = requests[0]

        assert safe_urlopen.called
        assert requests_count == 1
        assert first_request["response_code"] == 0
        assert first_request["event_type"] == "issue.assigned"
        assert first_request["organization_id"] == self.install.organization.id

    @patch("sentry.tasks.sentry_apps.safe_urlopen", return_value=MockResponseWithHeadersInstance)
    def test_saves_error_event_id_if_in_header(self, safe_urlopen):
        data = {"issue": serialize(self.issue)}
        with self.assertRaises(ClientError):
            send_webhooks(
                installation=self.install, event="issue.assigned", data=data, actor=self.user
            )

        requests = self.buffer.get_requests()
        requests_count = len(requests)
        first_request = requests[0]

        assert safe_urlopen.called
        assert requests_count == 1
        assert first_request["response_code"] == 400
        assert first_request["event_type"] == "issue.assigned"
        assert first_request["organization_id"] == self.install.organization.id
        assert first_request["error_id"] == "d5111da2c28645c5889d072017e3445d"
        assert first_request["project_id"] == "1"
