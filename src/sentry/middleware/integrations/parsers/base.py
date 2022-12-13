from __future__ import annotations

import abc
import logging
from typing import Callable, Iterable, Sequence

from django.http.request import HttpRequest
from django.urls import ResolverMatch, resolve

from sentry.models.integrations import Integration, OrganizationIntegration
from sentry.models.organization import Organization
from sentry.silo import SiloLimit, SiloMode
from sentry.silo.client import RegionSiloClient
from sentry.types.region import Region, get_region_for_organization

logger = logging.getLogger(__name__)


class BaseRequestParser(abc.ABC):
    """Base Class for Integration Request Parsers"""

    def __init__(self, request: HttpRequest, response_handler: Callable):
        self.request = request
        self.match: ResolverMatch = resolve(self.request.path)
        self.response_handler = response_handler
        self.error_message = "Integration Request Parsers should only be run on the control silo."

    def _ensure_control_silo(self):
        if SiloMode.get_current_mode() != SiloMode.CONTROL:
            logger.error(
                "integration_control.base.silo_error",
                extra={"path": self.request.path, "silo": SiloMode.get_current_mode()},
            )
            raise SiloLimit.AvailabilityError(self.error_message)

    def get_response_from_control_silo(self):
        """
        Used to handle the request directly on the control silo.
        """
        self._ensure_control_silo()
        return self.response_handler(self.request)

    def get_response_from_region_silo(self, regions: Iterable[Region]):
        """
        Used to handle the requests on a given list of regions (synchronously).
        If multiple regions are provided, only the last response is returned to the requestor.
        """
        self._ensure_control_silo()
        region_response = None
        for region in regions:
            region_client = RegionSiloClient(region)
            region_response = region_client.proxy_request(self.request).to_http_response()
        if region_response is None:
            logger.error(
                "integration_control.base.region_proxy_error",
                extra={
                    "path": self.request.path,
                    "regions": [region.name for region in regions],
                },
            )
            return self.response_handler(self.request)
        return region_response

    def get_response(self):
        """
        Used to surface a response as part of the middleware.
        Should be overwritten by implementation.
        Default behaviour is handle the response ignoring SiloMode.
        """
        return self.response_handler(self.request)

    def get_integration(self) -> Integration | None:
        """
        Parse the request to retreive organizations to forward the request to.
        Should be overwritten by implementation.
        """
        return None

    def get_organizations(self, integration: Integration = None) -> Sequence[Organization]:
        """
        Use the get_integration() method to identify organizations associated with
        the integration request.
        """
        if not integration:
            integration = self.get_integration()
        if not integration:
            logger.error(
                "integration_control.base.no_integration",
                extra={"path": self.request.path},
            )
            return []
        organization_integrations = OrganizationIntegration.objects.filter(
            integration_id=integration
        ).select_related("organization")
        return [integration.organization for integration in organization_integrations]

    def get_regions(self, organizations: Sequence[Organization] = None) -> Sequence[Region]:
        """
        Use the get_organizations() method to identify forwarding regions.
        """
        if not organizations:
            organizations = self.get_organizations()
        if not organizations:
            logger.error(
                "integration_control.base.no_organizations",
                extra={"path": self.request.path},
            )
            return []

        return [get_region_for_organization(organization) for organization in organizations]
