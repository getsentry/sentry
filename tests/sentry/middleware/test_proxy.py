from __future__ import annotations

from dataclasses import asdict
from functools import cached_property

import pytest
from django.http import HttpRequest
from django.urls import reverse
from pytest_django.live_server_helper import LiveServer
from rest_framework.test import APIClient

from sentry.middleware.proxy import SetRemoteAddrFromForwardedFor
from sentry.models import ApiKey, Organization, Team
from sentry.silo import SiloMode
from sentry.testutils.asserts import assert_status_code
from sentry.testutils.cases import APITestCase, TestCase, TransactionTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.region import override_regions
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, region_silo_test
from sentry.types.region import Region, RegionCategory
from sentry.utils import json


class SetRemoteAddrFromForwardedForTestCase(TestCase):
    middleware = cached_property(SetRemoteAddrFromForwardedFor)

    def test_ipv4(self):
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_FOR"] = "8.8.8.8:80,8.8.4.4"
        self.middleware.process_request(request)
        assert request.META["REMOTE_ADDR"] == "8.8.8.8"

    def test_ipv4_whitespace(self):
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_FOR"] = "8.8.8.8:80 "
        self.middleware.process_request(request)
        assert request.META["REMOTE_ADDR"] == "8.8.8.8"

    def test_ipv6(self):
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_FOR"] = "2001:4860:4860::8888,2001:4860:4860::8844"
        self.middleware.process_request(request)
        assert request.META["REMOTE_ADDR"] == "2001:4860:4860::8888"


test_region = Region(
    "us",
    1,
    "https://test",
    RegionCategory.MULTI_TENANT,
)


@region_silo_test(stable=True, regions=[test_region])
@pytest.mark.usefixtures("live_server")
class EndToEndAPIProxyTest(TransactionTestCase):
    live_server: LiveServer
    endpoint = "sentry-api-0-organization-teams"
    method = "post"
    organization: Organization
    api_key: ApiKey

    @pytest.fixture(autouse=True)
    def initialize(self, live_server):
        self.live_server = live_server
        self.client = APIClient()

    def tearDown(self) -> None:
        self.live_server.stop()

    def get_response(self, *args, **params):
        url = reverse(self.endpoint, args=args)
        headers = params.pop("extra_headers", {})
        return getattr(self.client, self.method)(url, format="json", data=params, **headers)

    def test_through_api_gateway(self):
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            return

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


@control_silo_test(stable=True, regions=[test_region])
class FakedAPIProxyTest(APITestCase):
    endpoint = "sentry-api-0-organization-teams"
    method = "post"

    def test_through_api_gateway(self):
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            return

        self.login_as(user=self.user)

        with self.api_gateway_proxy_stubbed():
            resp = self.get_success_response(
                self.organization.slug,
                name="hello world",
                idp_provisioned=True,
                status_code=201,
            )

        result = json.loads(resp.getvalue())
        with assume_test_silo_mode(SiloMode.REGION):
            team = Team.objects.get(id=result["id"])
            assert team.idp_provisioned
