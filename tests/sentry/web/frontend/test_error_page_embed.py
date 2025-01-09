import logging
from unittest import mock
from urllib.parse import quote, urlencode
from uuid import uuid4

from django.test import override_settings
from django.urls import reverse

from sentry.models.environment import Environment
from sentry.models.userreport import UserReport
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.types.region import get_local_region


@override_settings(ROOT_URLCONF="sentry.conf.urls")
class ErrorPageEmbedTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.project.update_option("sentry:origins", ["example.com"])
        self.key = self.create_project_key(self.project)
        self.event_id = uuid4().hex
        self.path = reverse("sentry-error-page-embed")
        self.path_with_qs = "{}?eventId={}&dsn={}".format(
            self.path,
            quote(self.event_id),
            quote(self.key.dsn_public),
        )

    def test_invalid_referer(self):
        resp = self.client.get(self.path_with_qs, HTTP_REFERER="http://foo.com")
        assert resp.status_code == 403, resp.content
        assert resp["Content-Type"] == "application/json"

    def test_invalid_origin(self):
        resp = self.client.get(self.path_with_qs, HTTP_ORIGIN="http://foo.com")
        assert resp.status_code == 403, resp.content
        assert resp["Content-Type"] == "application/json"

    def test_invalid_origin_respects_accept(self):
        resp = self.client.get(
            self.path_with_qs,
            HTTP_ORIGIN="http://foo.com",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 403, resp.content
        assert resp["Content-Type"] == "text/javascript"

    def test_missing_eventId(self):
        path = f"{self.path}?dsn={quote(self.key.dsn_public)}"
        resp = self.client.get(
            path, HTTP_REFERER="http://example.com", HTTP_ACCEPT="text/html, text/javascript"
        )
        assert resp.status_code == 400, resp.content
        assert resp["Content-Type"] == "text/javascript"
        assert resp["X-Sentry-Context"] == '{"eventId":"Missing or invalid parameter."}'
        assert resp.content == b""

    def test_missing_dsn(self):
        path = f"{self.path}?eventId={quote(self.event_id)}"
        resp = self.client.get(
            path, HTTP_REFERER="http://example.com", HTTP_ACCEPT="text/html, text/javascript"
        )
        assert resp.status_code == 404, resp.content
        assert resp["Content-Type"] == "text/javascript"
        assert resp["X-Sentry-Context"] == '{"dsn":"Missing or invalid parameter."}'
        assert resp.content == b""

    def test_renders(self):
        resp = self.client.get(
            self.path_with_qs,
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 200, resp.content
        assert resp["Access-Control-Allow-Origin"] == "*"
        self.assertTemplateUsed(resp, "sentry/error-page-embed.html")

    def test_endpoint_reflects_region_url(self):
        resp = self.client.get(
            self.path_with_qs,
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 200, resp.content
        assert resp["Access-Control-Allow-Origin"] == "*"
        self.assertTemplateUsed(resp, "sentry/error-page-embed.html")

        region = get_local_region()
        region_url = region.to_url(self.path_with_qs)
        body = resp.content.decode("utf8")
        assert f'endpoint = /**/"{region_url}";/**/' in body

    def test_uses_locale_from_header(self):
        resp = self.client.get(
            self.path_with_qs,
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT_LANGUAGE="fr",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 200, resp.content
        self.assertTemplateUsed(resp, "sentry/error-page-embed.html")
        assert b"Fermer" in resp.content  # Close

    def test_xss(self):
        user_feedback_options = {}

        option_keys = [
            "errorFormEntry",
            "successMessage",
            "errorGeneric",
            "title",
            "subtitle",
            "subtitle2",
            "labelName",
            "labelEmail",
            "labelComments",
            "labelSubmit",
            "labelClose",
        ]
        for key in option_keys:
            user_feedback_options[key] = "<img src=x onerror=alert({0})>XSS_{0}".format(key).encode(
                "utf-8"
            )

        user_feedback_options_qs = urlencode(user_feedback_options)
        path_with_qs = "{}?eventId={}&dsn={}&{}".format(
            self.path,
            quote(self.event_id),
            quote(self.key.dsn_public),
            user_feedback_options_qs,
        )
        resp = self.client.get(
            path_with_qs,
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 200, resp.content
        self.assertTemplateUsed(resp, "sentry/error-page-embed.html")

        for xss_payload in user_feedback_options.values():
            assert xss_payload not in resp.content

    def test_submission(self):
        resp = self.client.post(
            self.path_with_qs,
            {"name": "Jane Bloggs", "email": "jane@example.com", "comments": "This is an example!"},
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert resp.status_code == 200, resp.content

        report = UserReport.objects.get()
        assert report.name == "Jane Bloggs"
        assert report.email == "jane@example.com"
        assert report.comments == "This is an example!"
        assert report.event_id == self.event_id
        assert report.project_id == self.project.id
        assert report.group_id is None

        resp = self.client.post(
            self.path_with_qs,
            {"name": "Joe Shmoe", "email": "joe@example.com", "comments": "haha I updated it!"},
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert resp.status_code == 200, resp.content

        report = UserReport.objects.get()
        assert report.name == "Joe Shmoe"
        assert report.email == "joe@example.com"
        assert report.comments == "haha I updated it!"
        assert report.event_id == self.event_id
        assert report.project_id == self.project.id
        assert report.group_id is None

    def test_submission_invalid_event_id(self):
        self.event_id = "x" * 100
        path = "{}?eventId={}&dsn={}".format(
            self.path,
            quote(self.event_id),
            quote(self.key.dsn_public),
        )

        resp = self.client.post(
            path,
            {"name": "Jane Bloggs", "email": "jane@example.com", "comments": "This is an example!"},
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert resp.status_code == 400, resp.content

    def test_submission_message_too_large(self):
        resp = self.client.post(
            self.path_with_qs,
            {"name": "Jane Bloggs", "email": "jane@example.com", "comments": "a" * 9001},
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert resp.status_code == 400, resp.content
        assert not UserReport.objects.exists()


@override_settings(ROOT_URLCONF="sentry.conf.urls")
class ErrorPageEmbedEnvironmentTest(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.project.update_option("sentry:origins", ["example.com"])
        self.key = self.create_project_key(self.project)
        self.event_id = uuid4().hex
        self.path = "{}?eventId={}&dsn={}".format(
            reverse("sentry-error-page-embed"),
            quote(self.event_id),
            quote(self.key.dsn_public),
        )
        self.environment = Environment.objects.create(
            organization_id=self.project.organization_id,
            name="production",
        )
        self.environment.add_project(self.project)

    def make_event(self, **kwargs):
        min_ago = before_now(minutes=1).isoformat()
        result = {
            "event_id": "a" * 32,
            "message": "foo",
            "timestamp": min_ago,
            "level": logging.ERROR,
            "logger": "default",
            "tags": [],
        }
        result.update(kwargs)
        return self.store_event(data=result, project_id=self.project.id, assert_no_errors=False)

    def test_environment_gets_user_report(self):
        self.make_event(environment=self.environment.name, event_id=self.event_id)
        self.login_as(user=self.user)
        response = self.client.post(
            self.path,
            {"name": "Jane Bloggs", "email": "jane@example.com", "comments": "This is an example!"},
            HTTP_REFERER="http://example.com",
        )

        assert response.status_code == 200, response.content
        assert UserReport.objects.get(event_id=self.event_id).environment_id == self.environment.id

    @mock.patch("sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka")
    def test_calls_feedback_shim_if_ff_enabled(self, mock_produce_occurrence_to_kafka):
        self.make_event(environment=self.environment.name, event_id=self.event_id)
        self.client.post(
            self.path,
            {
                "name": "Jane Bloggs",
                "email": "jane@example.com",
                "comments": "This is an example!",
            },
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1
        mock_event_data = mock_produce_occurrence_to_kafka.call_args_list[0][1]["event_data"]
        assert mock_event_data["contexts"]["feedback"]["contact_email"] == "jane@example.com"
        assert mock_event_data["contexts"]["feedback"]["message"] == "This is an example!"
        assert mock_event_data["contexts"]["feedback"]["name"] == "Jane Bloggs"
        assert mock_event_data["platform"] == "other"
        assert mock_event_data["contexts"]["feedback"]["associated_event_id"] == self.event_id
        assert mock_event_data["level"] == "error"

    @mock.patch("sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka")
    def test_does_not_call_feedback_shim_no_event_if_ff_enabled(
        self, mock_produce_occurrence_to_kafka
    ):
        self.client.post(
            self.path,
            {
                "name": "Jane Bloggs",
                "email": "jane@example.com",
                "comments": "This is an example!",
            },
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0
