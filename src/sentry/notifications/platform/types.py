from enum import StrEnum
from typing import TYPE_CHECKING, TypeVar

from sentry.integrations.types import ExternalProviderEnum

if TYPE_CHECKING:
    from sentry.notifications.platform.discord.provider import DiscordRenderable
    from sentry.notifications.platform.email.provider import EmailRenderable
    from sentry.notifications.platform.msteams.provider import MSTeamsRenderable
    from sentry.notifications.platform.slack.provider import SlackRenderable


NotificationRenderableT = TypeVar("NotificationRenderableT", covariant=True)
"""
A renderable object that is understood by the notification provider.
For example, Email might expect HTML, or raw text; Slack might expect a JSON Block Kit object.
"""


class NotificationProviderKey(StrEnum):
    """
    The unique keys for each registered notification provider.
    """

    EMAIL = ExternalProviderEnum.EMAIL
    SLACK = ExternalProviderEnum.SLACK
    MSTEAMS = ExternalProviderEnum.MSTEAMS
    DISCORD = ExternalProviderEnum.DISCORD


type NotificationRenderable = DiscordRenderable | EmailRenderable | SlackRenderable | MSTeamsRenderable
"""
Union type of all notification known renderables. When a new provider inherits the
Provides stricter typing for permitted notification providers added to the registry.
"""
