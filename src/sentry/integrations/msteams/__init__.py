from sentry.integrations.msteams.spec import MsTeamsMessagingSpec

from .handlers import MSTeamsActionHandler  # noqa: F401,F403
from .notifications import *  # noqa: F401,F403

MsTeamsMessagingSpec().initialize()
