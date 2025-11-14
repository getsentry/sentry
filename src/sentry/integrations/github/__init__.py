from typing import int
from sentry.rules import rules

from .actions.create_ticket import GitHubCreateTicketAction
from .handlers import GithubActionHandler  # noqa: F401,F403

rules.add(GitHubCreateTicketAction)
