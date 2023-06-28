from copy import deepcopy
from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIRequestFactory

from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.msteams import MsTeamsRequestParser
from sentry.models import Integration
from sentry.silo.base import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory
from tests.sentry.integrations.msteams.test_helpers import (
    EXAMPLE_MENTIONED,
    EXAMPLE_PERSONAL_MEMBER_ADDED,
    EXAMPLE_TEAM_MEMBER_ADDED,
    EXAMPLE_TEAM_MEMBER_REMOVED,
    EXAMPLE_UNLINK_COMMAND,
    GENERIC_EVENT,
    TOKEN,
)


@control_silo_test(stable=True)
class MsTeamsRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    factory = APIRequestFactory()
    path = f"{IntegrationControlMiddleware.integration_prefix}msteams/webhook/"
    region = Region("na", 1, "https://na.testserver", RegionCategory.MULTI_TENANT)

    def setUp(self):
        super().setUp()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_properly(self):
        request = self.factory.post(
            self.path,
            data=GENERIC_EVENT,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

        # No regions identified
        with mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[]
        ):
            parser.get_response()
            assert get_response_from_control_silo.called

        # Regions found
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert get_response_from_outbox_creation.called

        # Non-webhook url
        with mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo:
            parser.request = self.factory.get(
                reverse("sentry-integration-msteams-configure"),
            )
            parser.get_response()
            assert get_response_from_control_silo.called

            parser.request = self.factory.get(
                reverse(
                    "sentry-integration-msteams-link-identity",
                    kwargs={"signed_params": "something"},
                ),
            )
            parser.get_response()
            assert get_response_from_control_silo.called

            parser.request = self.factory.get(
                reverse(
                    "sentry-integration-msteams-unlink-identity",
                    kwargs={"signed_params": "something"},
                ),
            )
            parser.get_response()
            assert get_response_from_control_silo.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_integration_from_request(self):
        team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"
        expected_integration = Integration.objects.create(external_id=team_id, provider="msteams")
        request = self.factory.post(
            self.path,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
        )

        region_silo_payloads = [
            EXAMPLE_TEAM_MEMBER_REMOVED,
            EXAMPLE_TEAM_MEMBER_ADDED,
            EXAMPLE_MENTIONED,
        ]

        for payload in region_silo_payloads:
            request.data = payload  # type:ignore
            parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)
            integration = parser.get_integration_from_request()
            assert integration == expected_integration

        help_command = deepcopy(EXAMPLE_UNLINK_COMMAND)
        help_command["text"] = "Help"
        control_silo_payloads = [GENERIC_EVENT, help_command, EXAMPLE_PERSONAL_MEMBER_ADDED]
        for payload in control_silo_payloads:
            request.data = payload  # type:ignore
            parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)
            integration = parser.get_integration_from_request()
            assert integration is None
