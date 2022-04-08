from sentry.rules import rules
from sentry.utils.imports import import_submodules

from .notify_action import AzureDevopsCreateTicketAction

rules.add(AzureDevopsCreateTicketAction)
import_submodules(globals(), __name__, __path__)  # type: ignore
