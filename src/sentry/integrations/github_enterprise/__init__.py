from sentry import options
from sentry.rules import rules

from .actions.create_ticket import GitHubEnterpriseCreateTicketAction

if options.get("github-enterprise-app.alert-rule-action"):
    rules.add(GitHubEnterpriseCreateTicketAction)
