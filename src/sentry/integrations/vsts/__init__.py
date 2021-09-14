from sentry.rules import rules
from sentry.utils.imports import import_submodules

from .notify_action import AzureDevopsCreateTicketAction

path = __path__  # type: ignore
import_submodules(globals(), __name__, path)

rules.add(AzureDevopsCreateTicketAction)
