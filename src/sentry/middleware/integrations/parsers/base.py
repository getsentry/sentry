import abc
from typing import Sequence

from django.http.request import HttpRequest


class BaseRequestParser(abc.ABC):
    """Base Class for Webhook Request Parsers"""

    def __init__(self, request: HttpRequest):
        self.request = request

    def should_disperse(self):
        """
        Evaluate whether or not a webhook should be forwarded to different regions
        """
        return False

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
