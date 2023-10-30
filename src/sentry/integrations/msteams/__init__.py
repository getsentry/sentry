from sentry.rules import rules

from .actions.form import *  # noqa: F401,F403
from .actions.notification import *  # noqa: F401,F403
from .actions.notification import MsTeamsNotifyServiceAction
from .analytics import *  # noqa: F401,F403
from .card_builder.base import *  # noqa: F401,F403
from .card_builder.block import *  # noqa: F401,F403
from .card_builder.help import *  # noqa: F401,F403
from .card_builder.identity import *  # noqa: F401,F403
from .card_builder.installation import *  # noqa: F401,F403
from .card_builder.notifications import *  # noqa: F401,F403
from .client import *  # noqa: F401,F403
from .integration import *  # noqa: F401,F403
from .link_identity import *  # noqa: F401,F403
from .notifications import *  # noqa: F401,F403
from .unlink_identity import *  # noqa: F401,F403
from .urls import *  # noqa: F401,F403
from .utils import *  # noqa: F401,F403
from .webhook import *  # noqa: F401,F403

rules.add(MsTeamsNotifyServiceAction)
