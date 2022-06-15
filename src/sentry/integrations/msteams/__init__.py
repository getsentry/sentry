from sentry.rules import rules

from .actions.form import *  # noqa: F401,F403
from .actions.notification import *  # noqa: F401,F403
from .actions.notification import MsTeamsNotifyServiceAction
from .card_builder import *  # noqa: F401,F403
from .client import *  # noqa: F401,F403
from .integration import *  # noqa: F401,F403
from .link_identity import *  # noqa: F401,F403
from .unlink_identity import *  # noqa: F401,F403
from .urls import *  # noqa: F401,F403
from .utils import *  # noqa: F401,F403
from .webhook import *  # noqa: F401,F403

rules.add(MsTeamsNotifyServiceAction)
