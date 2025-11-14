from typing import int
class InvalidProviderException(Exception):
    """
    Provider that is passed does not exist.
    """

    pass


class OrganizationIntegrationNotFound(Exception):
    pass
