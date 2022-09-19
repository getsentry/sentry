import abc
from typing import Sequence

from django.http.request import HttpRequest


class BaseRequestParser(abc.ABC):
    """Base Class for Webhook Request Parsers"""

    exempt_paths: Sequence[str] = []
    """
    Paths caught by the parser that will not have their requests forwarded. These will be
    handled by the Control Silo directly.
    """

    def __init__(self, request: HttpRequest):
        self.request = request

    def is_path_exempt(self) -> bool:
        """
        Returns whether or not the current request path is exempt.
        """
        return self.request.path in self.exempt_paths

    def get_organizations(self):
        """
        Parse the request to retreive organizations to forward the request to.
        """
        raise NotImplementedError

    def get_regions(self) -> Sequence[str]:
        """
        Use the get_organizations() method to identify forwarding regions.
        """
        # TODO(Leander): Implement this after region mapping is added
        # organizations: Sequence[Organization] = self.get_organizations()
        # return [organization.region for organization in organizations]
        self.get_organizations()
        return []
