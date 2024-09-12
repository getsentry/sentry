from sentry.integrations.slack.spec import SlackMessagingSpec

# TODO: Delete this after removing getsentry dependency
from .actions.notification import SlackNotifyServiceAction  # noqa: F401,F403

SlackMessagingSpec().initialize()
