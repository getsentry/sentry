import pytest
import responses
from jsonschema import ValidationError

from sentry.coreapi import APIError
from sentry.sentry_apps.external_requests.select_requester import SelectRequester
from sentry.sentry_apps.services.app import app_service
from sentry.testutils.cases import TestCase
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


class TestSelectRequester(TestCase):
    def setUp(self):
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
    def test_makes_request(self):
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

    @responses.activate
    def test_invalid_response_missing_label(self):
        # missing 'label'
        invalid_format = {"value": "12345"}
        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            json=invalid_format,
            status=200,
            content_type="application/json",
        )

        with pytest.raises(ValidationError):
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri="/get-issues",
            ).run()

    @responses.activate
    def test_invalid_response_missing_value(self):
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

        with pytest.raises(ValidationError):
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri="/get-issues",
            ).run()

    @responses.activate
    def test_500_response(self):
        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            body="Something failed",
            status=500,
        )

        with pytest.raises(APIError):
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
    def test_api_error_message(self):
        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            body="Something failed",
            status=500,
        )

        with pytest.raises(APIError) as exception_info:
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri="/get-issues",
            ).run()
        assert (
            str(exception_info.value)
            == f"Something went wrong while getting SelectFields from {self.sentry_app.slug}"
        )

    @responses.activate
    def test_validation_error_message_validator(self):
        uri = "/get-issues"

        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            json={},
            status=200,
        )

        with pytest.raises(ValidationError) as exception_info:
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri=uri,
            ).run()

        assert (
            str(exception_info.value)
            == f"Invalid response format for SelectField in {self.sentry_app.slug} from uri: {uri}"
        )

    @responses.activate
    def test_validation_error_message_missing_field(self):
        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-issues?installationId={self.install.uuid}&projectSlug={self.project.slug}",
            json=[{"bruh": "bruhhhhh"}],
            status=200,
        )

        with pytest.raises(ValidationError) as exception_info:
            SelectRequester(
                install=self.install,
                project_slug=self.project.slug,
                uri="/get-issues",
            ).run()

        assert (
            str(exception_info.value) == "Missing `value` or `label` in option data for SelectField"
        )
