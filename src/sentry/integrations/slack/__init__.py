from sentry.rules import rules
from sentry.utils.imports import import_submodules

from .actions import SlackNotifyServiceAction

import_submodules(globals(), __name__, __path__)  # type: ignore

rules.add(SlackNotifyServiceAction)
