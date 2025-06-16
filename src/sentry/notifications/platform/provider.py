from typing import TYPE_CHECKING, Protocol

from sentry.notifications.platform.types import NotificationProviderKey
from sentry.organizations.services.organization.model import RpcOrganizationSummary

if TYPE_CHECKING:
    from sentry.notifications.platform.renderer import NotificationRenderer


class NotificationProvider[T](Protocol):
    """
    A protocol metaclass for all notification providers.

    Accepts a renderable object type that is understood by the notification provider.
    For example, Email might expect HTML, or raw text; Slack might expect a JSON Block Kit object.
    """

    key: NotificationProviderKey
    default_renderer: type["NotificationRenderer[T]"]

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        """
        Returns `True` if the provider is available given the key word arguments.
        """
        ...
