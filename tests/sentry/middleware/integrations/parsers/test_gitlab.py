from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from fixtures.gitlab import EXTERNAL_ID, PUSH_EVENT, WEBHOOK_SECRET, WEBHOOK_TOKEN
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.gitlab import GitlabRequestParser
from sentry.models.outbox import ControlOutbox, OutboxCategory, WebhookProviderIdentifier
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_webhook_outboxes
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test
class GitlabRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    factory = RequestFactory()
    path = f"{IntegrationClassification.integration_prefix}gitlab/webhook/"
    region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="gitlab",
            name="Example Gitlab",
            external_id=EXTERNAL_ID,
            metadata={
                "instance": "example.gitlab.com",
                "base_url": "https://example.gitlab.com",
                "domain_name": "example.gitlab.com/group-x",
                "verify_ssl": False,
                "webhook_secret": WEBHOOK_SECRET,
                "group_id": 1,
            },
        )

    def run_parser(self, request):
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)
        return parser.get_response()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_missing_x_gitlab_token(self):
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_EVENT="lol",
        )
        response = self.run_parser(request)
        assert response.status_code == 400
        assert (
            response.reason_phrase == "The customer needs to set a Secret Token in their webhook."
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_invalid_token(self):
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN="wrong",
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        response = self.run_parser(request)
        assert response.status_code == 400
        assert response.reason_phrase == "The customer's Secret Token is malformed."

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_webhook_properly(self):
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)

        # No regions identified
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[]
        ):
            parser.get_response()
            assert get_response_from_control_silo.called
            assert not get_response_from_outbox_creation.called

        # Regions found
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert get_response_from_outbox_creation.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_search_properly(self):
        path = reverse(
            "sentry-extensions-gitlab-search",
            kwargs={
                "organization_slug": self.organization.slug,
                "integration_id": self.integration.id,
            },
        )
        request = self.factory.post(path, data={}, content_type="application/json")
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo:
            parser.get_response()
            assert get_response_from_control_silo.called
            assert not get_response_from_outbox_creation.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_integration_from_request(self):
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)
        integration = parser.get_integration_from_request()
        assert integration == self.integration

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_webhook_outbox_creation(self):
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)

        assert ControlOutbox.objects.filter(category=OutboxCategory.WEBHOOK_PROXY).count() == 0
        with mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert_webhook_outboxes(
                factory_request=request,
                webhook_identifier=WebhookProviderIdentifier.GITLAB,
                region_names=[self.region.name],
            )
