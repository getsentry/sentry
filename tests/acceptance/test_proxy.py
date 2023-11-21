from __future__ import annotations

from dataclasses import asdict

import pytest
from django.urls import reverse
from pytest_django.live_server_helper import LiveServer
from rest_framework.test import APIClient

from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.silo import SiloMode
from sentry.testutils.asserts import assert_status_code
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.region import override_regions
from sentry.testutils.silo import region_silo_test
from sentry.types.region import Region
from sentry.utils import json
from tests.sentry.middleware.test_proxy import test_region


@pytest.fixture(scope="function")
def local_live_server(request, live_server):
    if hasattr(request, "cls"):
        request.cls.live_server = live_server
    request.node.live_server = live_server


@region_silo_test(regions=[test_region])
@pytest.mark.usefixtures("local_live_server")
class EndToEndAPIProxyTest(TransactionTestCase):
    live_server: LiveServer
    endpoint = "sentry-api-0-organization-teams"
    method = "post"
    organization: Organization
    api_key: ApiKey

    def get_response(self, *args, **params):
        url = reverse(self.endpoint, args=args)
        headers = params.pop("extra_headers", {})
        return getattr(self.client, self.method)(url, format="json", data=params, **headers)

    def test_through_api_gateway(self):
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            return

        self.client = APIClient()
        config = asdict(test_region)
        config["address"] = self.live_server.url

        with override_regions([Region(**config)]):
            self.organization = Factories.create_organization(owner=self.user, region="us")
            self.api_key = Factories.create_api_key(
                organization=self.organization, scope_list=["org:write", "org:admin", "team:write"]
            )

            with SiloMode.enter_single_process_silo_context(SiloMode.CONTROL):
                resp = self.get_response(
                    self.organization.slug,
                    name="hello world",
                    idp_provisioned=True,
                    extra_headers=dict(
                        HTTP_AUTHORIZATION=self.create_basic_auth_header(self.api_key.key)
                    ),
                )

        assert_status_code(resp, 201)
        result = json.loads(resp.getvalue())
        team = Team.objects.get(id=result["id"])
        assert team.idp_provisioned
