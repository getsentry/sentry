from __future__ import annotations

import abc
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Mapping, Sequence

from django.http import HttpRequest, HttpResponse
from django.urls import ResolverMatch, resolve

from sentry.models.integrations import Integration
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary, organization_service
from sentry.silo import SiloLimit, SiloMode
from sentry.silo.client import RegionSiloClient
from sentry.types.region import Region, get_region_for_organization
from sentry.utils.sdk import capture_exception

logger = logging.getLogger(__name__)


class RegionResult:
    def __init__(self, response: HttpResponse = None, error: Exception = None):
        self.response = response
        self.error = error


class BaseRequestParser(abc.ABC):
    """Base Class for Integration Request Parsers"""

    @property
    def provider() -> str:
        return "base"

    def log_name(self, log_name: str) -> str:
        return f"request_parser.{self.provider}.{log_name}"

    def __init__(self, request: HttpRequest, response_handler: Callable):
        self.request = request
        self.match: ResolverMatch = resolve(self.request.path)
        self.response_handler = response_handler

    def ensure_control_silo(self):
        if SiloMode.get_current_mode() != SiloMode.CONTROL:
            logger.error(
                self.log_name("silo_error"),
                extra={"path": self.request.path, "silo": SiloMode.get_current_mode()},
            )
            raise SiloLimit.AvailabilityError(
                "Integration Request Parsers should only be run on the control silo."
            )

    def get_response_from_control_silo(self) -> HttpResponse:
        """
        Used to handle the request directly on the control silo.
        """
        self.ensure_control_silo()
        return self.response_handler(self.request)

    def _get_response_from_region_silo(self, region: Region) -> HttpResponse:
        region_client = RegionSiloClient(region)
        return region_client.proxy_request(self.request).to_http_response()

    def get_response_from_region_silos(
        self, regions: Sequence[Region]
    ) -> Mapping[str, RegionResult]:
        """
        Used to handle the requests on a given list of regions (synchronously).
        Returns a mapping of region name to response/exception.
        If multiple regions are provided, only the latest response is returned to the requestor.
        """
        self.ensure_control_silo()

        region_to_response_map = {}

        with ThreadPoolExecutor(max_workers=len(regions)) as executor:
            future_to_region = {
                executor.submit(self._get_response_from_region_silo, region): region
                for region in regions
            }
            for future in as_completed(future_to_region):
                region = future_to_region[future]
                try:
                    region_response = future.result()
                # This will capture errors from this silo and any 4xx/5xx responses from others
                except Exception as e:
                    capture_exception(e)
                    logger.error(self.log_name("region_proxy_error"), extra={"region": region.name})
                    region_to_response_map[region.name] = RegionResult(error=e)
                else:
                    region_to_response_map[region.name] = RegionResult(result=region_response)

        if len(region_to_response_map) == 0:
            logger.error(
                self.log_name("region_no_response"),
                extra={
                    "path": self.request.path,
                    "regions": [region.name for region in regions],
                },
            )
            return self.response_handler(self.request)

        return region_to_response_map

    def get_response(self):
        """
        Used to surface a response as part of the middleware.
        Should be overwritten by implementation.
        Default behaviour is handle the response ignoring SiloMode.
        """
        return self.response_handler(self.request)

    def get_integration(self) -> RpcIntegration | None:
        """
        Parse the request to retreive organizations to forward the request to.
        Should be overwritten by implementation.
        """
        return None

    def get_organizations(
        self, integration: Integration = None
    ) -> Sequence[RpcOrganizationSummary]:
        """
        Use the get_integration() method to identify organizations associated with
        the integration request.
        """
        if not integration:
            integration = self.get_integration()
        if not integration:
            logger.error(
                self.log_name("no_integration"),
                extra={"path": self.request.path},
            )
            return []
        organization_integrations = integration_service.get_organization_integrations(
            integration_id=integration.id
        )
        organization_ids = [oi.organization_id for oi in organization_integrations]
        return organization_service.get_organizations(
            user_id=None, scope=None, only_visible=False, organization_ids=organization_ids
        )

    def get_regions(
        self, organizations: Sequence[RpcOrganizationSummary] = None
    ) -> Sequence[Region]:
        """
        Use the get_organizations() method to identify forwarding regions.
        """
        if not organizations:
            organizations = self.get_organizations()
        if not organizations:
            logger.error(
                self.log_name("no_organizations"),
                extra={"path": self.request.path},
            )
            return []

        return [get_region_for_organization(organization) for organization in organizations]
