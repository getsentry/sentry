"""
Many of our integration providers offer competing products with the same
features. For example, both Slack and MS Teams are "communication platforms".
Both of these providers interact with Sentry in a similar way and should share
an interface to the rest of the repository. Those shared interfaces should be
defined as Mixins in this module. We should try to have as much shared business
logic between providers.
"""

__all__ = (
    "NotifyBasicMixin",
    "ResolveSyncAction",
    "ServerlessMixin",
    "SUCCESS_UNLINKED_TEAM_MESSAGE",
    "SUCCESS_UNLINKED_TEAM_TITLE",
)

from .issues import ResolveSyncAction
from .notifications import (
    SUCCESS_UNLINKED_TEAM_MESSAGE,
    SUCCESS_UNLINKED_TEAM_TITLE,
    NotifyBasicMixin,
)
from .serverless import ServerlessMixin
