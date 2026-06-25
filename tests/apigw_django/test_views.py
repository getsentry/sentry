# TODO: tests still needed:
#   - Path normalization: reject paths starting with //, append trailing slash
#   - Header security: client-supplied X-Apigateway stripped, gateway sets its own,
#     hop-by-hop headers removed
#   - Body size limit: Content-Length over cap returns 413
#   - Downstream errors: httpx timeout → 504, connection error → 502
#   - Response streaming: headers cleaned, content-type forwarded, body streamed
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from asgiref.sync import async_to_sync
from django.test import RequestFactory, override_settings
from django.urls import Resolver404

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.cell import Cell

CELL = Cell(name="us", snowflake_id=1, address="http://us.internal.sentry.io")
CONTROL_ADDRESS = "http://control.internal.sentry.io"

_proxy_view = async_to_sync(__import__("apigw_django.views", fromlist=["proxy_view"]).proxy_view)


def make_request(path, method="GET"):
    return getattr(RequestFactory(), method.lower())(path)


class ProxyViewRoutingTest(TestCase):
    def setUp(self):
        super().setUp()
        self._cells_ctx = override_cells([CELL], local_cell=CELL)
        self._cells_ctx.__enter__()
        # Create org + mapping without triggering outbox drains or RPC calls.
        # The tests call proxy_view directly — they only need the DB rows
        # for cell resolution, not full org replication.
        with outbox_context(flush=False):
            with override_settings(SILO_MODE=SiloMode.CELL, SENTRY_LOCAL_CELL=CELL.name):
                self.organization = Organization.objects.create(name="test-org")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrganizationMapping.objects.create(
                organization_id=self.organization.id,
                slug=self.organization.slug,
                cell_name=CELL.name,
            )

    def tearDown(self):
        self._cells_ctx.__exit__(None, None, None)
        super().tearDown()

    @pytest.fixture(autouse=True)
    def _patch_proxy(self):
        with patch("apigw_django.views.proxy_to_host", new_callable=AsyncMock) as mock:
            self.mock_proxy_to_host = mock
            yield

    @override_settings(SENTRY_CONTROL_ADDRESS=CONTROL_ADDRESS, SILO_MODE=SiloMode.CONTROL)
    def test_cell_endpoint_with_org_proxies_to_cell(self):
        """Cell-silo endpoint with organization_id_or_slug routes to the org's cell."""
        request = make_request(f"/api/0/organizations/{self.organization.slug}/projects/")
        _proxy_view(request)

        self.mock_proxy_to_host.assert_awaited_once()
        args = self.mock_proxy_to_host.call_args[0]
        assert args[1] == CELL.address
        assert args[2] == "sentry-api-0-organization-projects"

    @override_settings(SENTRY_CONTROL_ADDRESS=CONTROL_ADDRESS)
    def test_control_endpoint_proxies_to_control(self):
        """Control-silo endpoint routes to the control silo address."""
        request = make_request(f"/api/0/organizations/{self.organization.slug}/api-keys/")
        _proxy_view(request)

        self.mock_proxy_to_host.assert_awaited_once()
        args = self.mock_proxy_to_host.call_args[0]
        assert args[1] == CONTROL_ADDRESS
        assert args[2] == "sentry-api-0-organization-api-key-index"

    def test_region_pinned_endpoint_proxies_to_fallback_cell(self):
        """Cell endpoint with no org in URL but in REGION_PINNED_URL_NAMES goes to fallback cell."""
        request = make_request("/api/0/relays/register/challenge/")
        _proxy_view(request)

        self.mock_proxy_to_host.assert_awaited_once()
        args = self.mock_proxy_to_host.call_args[0]
        assert args[1] == CELL.address

    @override_settings(SENTRY_CONTROL_ADDRESS=CONTROL_ADDRESS)
    def test_unresolvable_path_returns_404(self):
        """Paths that don't resolve against Sentry's URL conf return 404.

        Sentry's URL conf has a frontend catch-all, so in practice almost
        nothing 404s. We patch the resolve to simulate a Resolver404.
        """
        with patch("apigw_django.views.resolve", side_effect=Resolver404):
            request = make_request("/anything/")
            response = _proxy_view(request)

        assert response.status_code == 404
        self.mock_proxy_to_host.assert_not_awaited()
