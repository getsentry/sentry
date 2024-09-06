class InvalidProviderException(Exception):
    """
    Provider that is passed does not exist.
    """

    pass


class IntegrationMiddlewareException(Exception):
    """
    Exception that is raised when an error occurs in the integration middleware.
    """

    pass
