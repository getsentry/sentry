__all__ = "Nel"

from sentry.interfaces.base import Interface


class Nel(Interface):
    """
    A browser NEL report.
    """

    title = "NEL report"
