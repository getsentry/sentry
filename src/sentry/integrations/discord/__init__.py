from sentry.rules import rules

from .actions import *  # noqa: F401,F403
from .actions import DiscordNotifyServiceAction
from .analytics import *  # noqa: F401,F403
from .client import *  # noqa: F401,F403
from .integration import *  # noqa: F401,F403
from .message_builder.base import *  # noqa: F401,F403
from .message_builder.issues import *  # noqa: F401,F403
from .urls import *  # noqa: F401,F403
from .utils import *  # noqa: F401,F403
from .views import *  # noqa: F401,F403

rules.add(DiscordNotifyServiceAction)
