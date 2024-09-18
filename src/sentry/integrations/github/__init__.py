from sentry.rules import rules

from .actions.create_ticket import GitHubCreateTicketAction

rules.add(GitHubCreateTicketAction)
