from sentry.rules import rules

from .actions import OpsgenieNotifyTeamAction
from .integration import *  # noqa: F401,F403

rules.add(OpsgenieNotifyTeamAction)
