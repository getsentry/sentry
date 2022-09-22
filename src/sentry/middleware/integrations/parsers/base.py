import abc
from typing import Callable

from django.http.request import HttpRequest

from sentry.silo import SiloLimit, SiloMode


class BaseRequestParser(abc.ABC):
    """Base Class for Integration Request Parsers"""

    _silo_mode = SiloMode.get_current_mode()

    def __init__(self, request: HttpRequest, response_handler: Callable):
        self.request = request
        self.response_handler = response_handler
        self.error_message = "Integration Request Parsers should only be run on the control silo."

    def get_response_from_control_silo(self):
        """
        Used to synchronously process the incoming request directly on the control silo.
        """
        if self._silo_mode != SiloMode.CONTROL:
            raise SiloLimit.AvailabilityError(self.error_message)
        return self.response_handler(self.request)

    def get_response_from_region_silo(self, regions, require_response=True):
        """
        Used to process the incoming request from region silos.
        """
        if self._silo_mode != SiloMode.CONTROL:
            raise SiloLimit.AvailabilityError(self.error_message)

        # TODO(Leander): Implement once region mapping exists
        # responses = [region.send(self.request) for region in regions]
        # return responses[0] -> Send back the first response
        return self.response_handler(self.request)

    def get_response(self):
        """
        Used to surface a response as part of the middleware.
        Default behaviour is to process the response in the control silo.
        """
        return self.get_response_from_control_silo()

    def get_organizations(self):
        """
        Parse the request to retreive organizations to forward the request to.
        """
        raise NotImplementedError

    def get_regions(self):
        """
        Use the get_organizations() method to identify forwarding regions.
        """
        # TODO(Leander): Implement once region mapping exists
        # organizations = self.get_organizations()
        # return [organization.region for organization in organizations]
        return []
