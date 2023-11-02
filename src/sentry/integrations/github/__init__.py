from sentry.rules import rules

from .actions.create_ticket import *  # noqa: F401,F403
from .actions.create_ticket import GitHubCreateTicketAction
from .client import *  # noqa: F401,F403
from .integration import *  # noqa: F401,F403
from .issues import *  # noqa: F401,F403
from .repository import *  # noqa: F401,F403
from .search import *  # noqa: F401,F403
from .urls import *  # noqa: F401,F403
from .utils import *  # noqa: F401,F403
from .webhook import *  # noqa: F401,F403

rules.add(GitHubCreateTicketAction)
