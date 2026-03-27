from __future__ import annotations

import asyncio
from functools import cached_property
from unittest.mock import patch

from django.http import HttpRequest

from sentry.middleware.proxy import SetRemoteAddrFromForwardedFor
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.cell import Cell, RegionCategory
from sentry.utils import json


class SetRemoteAddrFromForwardedForTestCase(TestCase):
    middleware = cached_property(SetRemoteAddrFromForwardedFor)

    def test_ipv4(self) -> None:
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_FOR"] = "8.8.8.8:80,8.8.4.4"
        self.middleware.process_request(request)
        assert request.META["REMOTE_ADDR"] == "8.8.8.8"

    def test_ipv4_whitespace(self) -> None:
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_FOR"] = "8.8.8.8:80 "
        self.middleware.process_request(request)
        assert request.META["REMOTE_ADDR"] == "8.8.8.8"

    def test_ipv6(self) -> None:
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_FOR"] = "2001:4860:4860::8888,2001:4860:4860::8844"
        self.middleware.process_request(request)
        assert request.META["REMOTE_ADDR"] == "2001:4860:4860::8888"


test_region = Cell(
    "us",
    1,
    "https://test",
    RegionCategory.MULTI_TENANT,
)


@control_silo_test(cells=[test_region])
class FakedAPIProxyTest(APITestCase):
    endpoint = "sentry-api-0-organization-teams"
    method = "post"

    def setUp(self) -> None:
        super().setUp()

        from sentry.hybridcloud.apigateway_async.middleware import ApiGatewayMiddleware

        _original_middleware = ApiGatewayMiddleware._process_view_inner

        def _process_view_match(self, request, view_func, view_args, view_kwargs):
            try:
                asyncio.get_running_loop()
                return self._process_view_inner(request, view_func, view_args, view_kwargs)
            except RuntimeError:
                return self._process_view_sync(request, view_func, view_args, view_kwargs)

        self._middleware_patch = patch.object(
            ApiGatewayMiddleware, "_process_view_match", _process_view_match
        )
        self._middleware_patch.start()

    def tearDown(self) -> None:
        self._middleware_patch.stop()
        super().tearDown()

    def test_through_api_gateway(self) -> None:
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

        result = json.loads(close_streaming_response(resp))
        with assume_test_silo_mode(SiloMode.CELL):
            team = Team.objects.get(id=result["id"])
            assert team.idp_provisioned
