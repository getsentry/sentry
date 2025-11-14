from typing import int
from sentry.rules import rules

from .actions.create_ticket import GitHubEnterpriseCreateTicketAction
from .handlers import GithubEnterpriseActionHandler  # noqa: F401,F403

rules.add(GitHubEnterpriseCreateTicketAction)
