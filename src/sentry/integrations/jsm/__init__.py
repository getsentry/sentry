from sentry.rules import rules

from .actions import JsmNotifyTeamAction
from .analytics import *  # noqa: F401,F403
from .handlers import JsmActionHandler  # noqa: F401,F403
from .integration import *  # noqa: F401,F403

rules.add(JsmNotifyTeamAction)
