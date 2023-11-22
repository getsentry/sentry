from __future__ import annotations

from functools import cached_property

from django.http import HttpRequest

from sentry.middleware.proxy import SetRemoteAddrFromForwardedFor
from sentry.models.team import Team
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
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


@control_silo_test(regions=[test_region])
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
