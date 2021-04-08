from sentry.rules import rules
from sentry.utils.imports import import_submodules

from .notify_action import SlackNotifyServiceAction

import_submodules(globals(), __name__, __path__)

rules.add(SlackNotifyServiceAction)
