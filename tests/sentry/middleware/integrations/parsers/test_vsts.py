from copy import deepcopy
from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIRequestFactory

from fixtures.vsts import WORK_ITEM_UNASSIGNED, WORK_ITEM_UPDATED, WORK_ITEM_UPDATED_STATUS
from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.vsts import VstsRequestParser
from sentry.models import Integration
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
class VstsRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    factory = APIRequestFactory()
    path = f"{IntegrationControlMiddleware.integration_prefix}vsts/issue-updated/"
    region = Region("na", 1, "https://na.testserver", RegionCategory.MULTI_TENANT)

    def setUp(self):
        super().setUp()
        self.shared_secret = "1234567890"

    def set_workitem_state(self, old_value, new_value):
        work_item = deepcopy(WORK_ITEM_UPDATED_STATUS)
        state = work_item["resource"]["fields"]["System.State"]

        if old_value is None:
            del state["oldValue"]
        else:
            state["oldValue"] = old_value
        state["newValue"] = new_value

        return work_item

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_properly(self):
        request = self.factory.post(
            self.path,
            data=WORK_ITEM_UPDATED,
            format="json",
            HTTP_SHARED_SECRET=self.shared_secret,
        )
        parser = VstsRequestParser(request=request, response_handler=self.get_response)

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

        # Non-webhook urls
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo:
            parser.request = self.factory.get(
                reverse("vsts-extension-configuration"), data={"targetId": "1", "targetName": "foo"}
            )
            parser.get_response()
            assert get_response_from_control_silo.called
            assert not get_response_from_outbox_creation.called

            parser.request = self.factory.get(
                reverse(
                    "sentry-extensions-vsts-search",
                    kwargs={"organization_slug": "albertos-apples", "integration_id": 1234},
                ),
            )
            parser.get_response()
            assert get_response_from_control_silo.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_integration_from_request(self):
        account_id = "80ded3e8-3cd3-43b1-9f96-52032624aa3a"
        expected_integration = Integration.objects.create(
            provider="vsts",
            external_id=account_id,
            name="vsts_name",
            metadata={
                "domain_name": "https://instance.visualstudio.com/",
                "subscription": {"id": 1234, "secret": self.shared_secret},
            },
        )

        request = self.factory.post(
            self.path,
            format="json",
            HTTP_SHARED_SECRET=self.shared_secret,
        )

        region_silo_payloads = [WORK_ITEM_UNASSIGNED, WORK_ITEM_UPDATED, WORK_ITEM_UPDATED_STATUS]

        for payload in region_silo_payloads:
            request.data = payload  # type:ignore
            parser = VstsRequestParser(request=request, response_handler=self.get_response)
            integration = parser.get_integration_from_request()
            assert integration == expected_integration

        # Invalid payload
        request.data = {"nonsense": True}  # type:ignore
        parser = VstsRequestParser(request=request, response_handler=self.get_response)
        integration = parser.get_integration_from_request()
        assert integration is None

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_webhook_outbox_creation(self):
        request = self.factory.post(
            self.path,
            data=WORK_ITEM_UPDATED,
            format="json",
            HTTP_SHARED_SECRET=self.shared_secret,
        )
        parser = VstsRequestParser(request=request, response_handler=self.get_response)

        assert ControlOutbox.objects.count() == 0
        with mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()

            assert ControlOutbox.objects.count() == 1
            outbox = ControlOutbox.objects.first()
            expected_payload = {
                "method": "POST",
                "path": self.path,
                "uri": f"http://testserver{self.path}",
                "headers": {
                    "Shared-Secret": self.shared_secret,
                    "Content-Length": "4652",
                    "Content-Type": "application/json",
                    "Cookie": "",
                },
                "body": request.body.decode(encoding="utf-8"),
            }
            assert outbox.payload == expected_payload
            assert outbox == ControlOutbox(
                id=outbox.id,
                shard_scope=OutboxScope.WEBHOOK_SCOPE,
                shard_identifier=WebhookProviderIdentifier.VSTS,
                object_identifier=1,
                category=OutboxCategory.WEBHOOK_PROXY,
                region_name=self.region.name,
                payload=expected_payload,
            )
