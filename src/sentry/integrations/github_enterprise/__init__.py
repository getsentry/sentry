from sentry import options
from sentry.rules import rules

from .actions.create_ticket import GitHubEnterpriseCreateTicketAction
from .handlers import GithubEnterpriseActionHandler  # noqa: F401,F403

if options.get("github-enterprise-app.alert-rule-action"):
    rules.add(GitHubEnterpriseCreateTicketAction)
