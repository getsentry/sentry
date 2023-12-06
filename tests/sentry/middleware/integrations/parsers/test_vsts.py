from copy import deepcopy
from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from fixtures.vsts import WORK_ITEM_UNASSIGNED, WORK_ITEM_UPDATED, WORK_ITEM_UPDATED_STATUS
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.vsts import VstsRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import ControlOutbox, WebhookProviderIdentifier
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_webhook_outboxes
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test
class VstsRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    factory = RequestFactory()
    path = f"{IntegrationClassification.integration_prefix}vsts/issue-updated/"
    region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)

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
            json=WORK_ITEM_UPDATED,
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

        region_silo_payloads = [WORK_ITEM_UNASSIGNED, WORK_ITEM_UPDATED, WORK_ITEM_UPDATED_STATUS]

        for payload in region_silo_payloads:
            request = self.factory.post(
                self.path,
                HTTP_SHARED_SECRET=self.shared_secret,
                data=payload,
                content_type="application/json",
            )
            parser = VstsRequestParser(request=request, response_handler=self.get_response)
            integration = parser.get_integration_from_request()
            assert integration == expected_integration

        # Invalid payload or content-type
        request = self.factory.post(
            self.path,
            HTTP_SHARED_SECRET=self.shared_secret,
            data=payload,
            content_type="multipart/form-data",
        )
        parser = VstsRequestParser(request=request, response_handler=self.get_response)
        integration = parser.get_integration_from_request()
        assert integration is None

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_webhook_outbox_creation(self):
        request = self.factory.post(
            self.path,
            json=WORK_ITEM_UPDATED,
            HTTP_SHARED_SECRET=self.shared_secret,
        )
        parser = VstsRequestParser(request=request, response_handler=self.get_response)

        assert ControlOutbox.objects.count() == 0
        with mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert_webhook_outboxes(
                factory_request=request,
                webhook_identifier=WebhookProviderIdentifier.VSTS,
                region_names=[self.region.name],
            )
