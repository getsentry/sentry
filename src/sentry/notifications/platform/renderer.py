from typing import Protocol

from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
)


# TODO(ecosystem): Evaluate whether or not this even makes sense as a protocol, or we can just use a typed Callable.
# If there is only one method, and the class usage is just to call a method, the Callable route might make more sense.
# The typing T is also sketchy being in only the return position, and not inherently connected to the provider class.
# The concept of renderers could just be a subset of functionality on the base provider class.
class NotificationRenderer[RenderableT](Protocol):
    """
    A protocol metaclass for all notification renderers.
    RenderableT is a type that matches the connected provider.
    """

    provider_key: NotificationProviderKey

    @classmethod
    def render[
        DataT: NotificationData
    ](cls, *, data: DataT, rendered_template: NotificationRenderedTemplate) -> RenderableT:
        """
        Convert a rendered template into a renderable object specific to the provider.
        For example, Slack might output BlockKit JSON, email might output HTML/txt.

        We pass in the data as well since custom renderers may use raw data to modify the output
        for the provider where the template cannot. For example, custom markdown formatting,
        provider-specific features like modals, etc.
        """
        ...
