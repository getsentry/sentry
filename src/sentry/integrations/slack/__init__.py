from sentry.rules import rules
from sentry.utils.imports import import_submodules

from .client import SlackClient  # NOQA
from .notify_action import SlackNotifyServiceAction

path = __path__  # type: ignore
import_submodules(globals(), __name__, path)

rules.add(SlackNotifyServiceAction)
