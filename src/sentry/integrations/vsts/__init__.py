from __future__ import absolute_import

from sentry.utils.imports import import_submodules
from sentry.rules import rules

from .notify_action import AzureDevopsCreateTicketAction

import_submodules(globals(), __name__, __path__)

rules.add(AzureDevopsCreateTicketAction)
