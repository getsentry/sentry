from sentry.rules import rules

from .actions.create_ticket import GitlabCreateTicketAction

rules.add(GitlabCreateTicketAction)
