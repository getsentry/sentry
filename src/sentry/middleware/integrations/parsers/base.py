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
from sentry.utils import json

# TODO(Leander): Replace once type is in place
logger = logging.getLogger(__name__)


class BaseRequestParser(abc.ABC):
    """Base Class for Integration Request Parsers"""

    def __init__(self, request: HttpRequest, response_handler: Callable):
        self.request = request
        self.match: ResolverMatch = resolve(self.request.path)
        self.response_handler = response_handler
        self.error_message = "Integration Request Parsers should only be run on the control silo."

    def _get_request_args(self):
        query_params = getattr(self.request, self.request.method, None)
        # In the event we receive an empty body `b''`, still treat it as a JSON request
        data = json.loads(self.request.body if len(self.request.body) > 0 else "{}")
        request_args = {
            "method": self.request.method,
            "path": self.request.path,
            "headers": self.request.headers,
            "data": data,
            "params": dict(query_params) if query_params is not None else None,
        }
        return request_args.values()

    def get_response_from_control_silo(self):
        """
        Used to synchronously process the incoming request directly on the control silo.
        """
        if SiloMode.get_current_mode() != SiloMode.CONTROL:
            logger.error(
                "integration_control.base.silo_error",
                extra={"path": self.request.path, "silo": SiloMode.get_current_mode()},
            )
            raise SiloLimit.AvailabilityError(self.error_message)
        return self.response_handler(self.request)

    def get_response_from_region_silo(self, regions: Iterable[Region]):
        """
        Used to process the incoming request from region silos.
        This shouldn't use the API Gateway to stay performant.
        """
        if SiloMode.get_current_mode() != SiloMode.CONTROL:
            logger.error(
                "integration_control.base.silo_error",
                extra={"path": self.request.path, "silo": SiloMode.get_current_mode()},
            )
            raise SiloLimit.AvailabilityError(self.error_message)

        region_response = None
        request_args = self._get_request_args()
        for region in regions:
            region_client = RegionSiloClient(region)
            region_response = region_client.request(*request_args)

        # If the response is sent to multiple regions, return the last response to the requestor
        return region_response

    def get_response(self):
        """
        Used to surface a response as part of the middleware.
        Default behaviour is to process the response in the control silo.
        """
        return self.get_response_from_control_silo()

    def get_integration(self) -> Integration | None:
        """
        Parse the request to retreive organizations to forward the request to.
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
