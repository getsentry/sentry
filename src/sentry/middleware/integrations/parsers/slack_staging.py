from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.middleware.integrations.parsers.slack import SlackRequestParser


class SlackStagingRequestParser(SlackRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.SLACK_STAGING]
