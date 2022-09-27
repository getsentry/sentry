from __future__ import annotations

import abc
import logging
from typing import Any, Callable, Sequence

from django.http.request import HttpRequest

from sentry.models.integrations import Integration, OrganizationIntegration
from sentry.models.organization import Organization
from sentry.silo import SiloLimit, SiloMode

# TODO(Leander): Replace once type is in place
Region = Any
logger = logging.getLogger(__name__)


class BaseRequestParser(abc.ABC):
    """Base Class for Integration Request Parsers"""

    def __init__(self, request: HttpRequest, response_handler: Callable):
        self.request = request
        self.response_handler = response_handler
        self.error_message = "Integration Request Parsers should only be run on the control silo."

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

    def get_response_from_region_silo(self, regions):
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

        # TODO(Leander): Implement once region mapping and cross-silo synchronous requests exist
        # responses = [region.send(self.request) for region in regions]
        # return responses[0] -> Send back the first response
        return self.response_handler(self.request)

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
        # TODO(Leander): Implement once region mapping exists
        if not organizations:
            organizations = self.get_integration()
        if not organizations:
            logger.error(
                "integration_control.base.no_organizations",
                extra={"path": self.request.path},
            )
            return []
        # organizations = self.get_organizations()
        # return [organization.region for organization in organizations]
        return []
