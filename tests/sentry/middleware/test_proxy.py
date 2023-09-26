from __future__ import annotations

from dataclasses import asdict
from functools import cached_property

import pytest
from django.http import HttpRequest
from pytest_django.live_server_helper import LiveServer

from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.middleware.proxy import SetRemoteAddrFromForwardedFor
from sentry.models import ApiKey, Organization, Team, User
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
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
class EndToEndAPIProxyTest(APITestCase):
    live_server: LiveServer
    endpoint = "sentry-api-0-organization-teams"
    method = "post"
    user: User
    organization: Organization
    api_key: ApiKey

    @pytest.fixture(autouse=True)
    def initialize(self, live_server):
        self.live_server = live_server

    @classmethod
    def setUpClass(cls) -> None:
        with in_test_hide_transaction_boundary():
            cls.user = Factories.create_user()
            with override_regions([test_region]):
                cls.organization = Factories.create_organization(owner=cls.user, region="us")
            cls.api_key = Factories.create_api_key(
                organization=cls.organization, scope_list=["org:write", "org:admin", "team:write"]
            )
            super().setUpClass()

    def test_through_api_gateway(self):
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            return

        config = asdict(test_region)
        config["address"] = self.live_server.url

        with override_regions([Region(**config)]), SiloMode.enter_single_process_silo_context(
            SiloMode.CONTROL
        ):
            # self.login_as(user=self.user)
            resp = self.get_success_response(
                self.organization.slug,
                name="hello world",
                idp_provisioned=True,
                status_code=201,
                extra_headers=dict(
                    HTTP_AUTHORIZATION=self.create_basic_auth_header(self.api_key.key)
                ),
            )

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
