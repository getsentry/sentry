from sentry import options
from sentry.rules import rules

from .actions.create_ticket import *  # noqa: F401,F403
from .actions.create_ticket import GitHubEnterpriseCreateTicketAction
from .client import *  # noqa: F401,F403
from .integration import *  # noqa: F401,F403
from .repository import *  # noqa: F401,F403
from .urls import *  # noqa: F401,F403
from .webhook import *  # noqa: F401,F403

if options.get("github-enterprise-app.alert-rule-action"):
    rules.add(GitHubEnterpriseCreateTicketAction)
