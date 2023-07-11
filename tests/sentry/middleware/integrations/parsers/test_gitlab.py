from typing import Any
from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from fixtures.gitlab import EXTERNAL_ID, PUSH_EVENT, WEBHOOK_SECRET, WEBHOOK_TOKEN
from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.gitlab import GitlabRequestParser
from sentry.models.outbox import (
    ControlOutbox,
    OutboxCategory,
    OutboxScope,
    WebhookProviderIdentifier,
)
from sentry.silo.base import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test(stable=True)
class GitlabRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    middleware = IntegrationControlMiddleware(get_response)
    factory = RequestFactory()
    path = f"{IntegrationControlMiddleware.integration_prefix}gitlab/webhook/"
    region = Region("na", 1, "https://na.testserver", RegionCategory.MULTI_TENANT)

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
    def test_routing_properly(self):
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

        assert ControlOutbox.objects.count() == 0
        with mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()

            assert ControlOutbox.objects.count() == 1
            outbox = ControlOutbox.objects.first()
            expected_payload: Any = {
                "method": "POST",
                "path": self.path,
                "uri": f"http://testserver{self.path}",
                "headers": {
                    "X-Gitlab-Token": WEBHOOK_TOKEN,
                    "X-Gitlab-Event": "Push Hook",
                    "Content-Length": "2434",
                    "Content-Type": "application/json",
                    "Cookie": "",
                },
                "body": request.body.decode(encoding="utf-8"),
            }
            assert outbox.payload == expected_payload
            assert outbox.shard_scope == OutboxScope.WEBHOOK_SCOPE
            assert outbox.shard_identifier == WebhookProviderIdentifier.GITLAB
            assert outbox.category == OutboxCategory.WEBHOOK_PROXY
            assert outbox.region_name == self.region.name
            assert outbox.payload == expected_payload
