from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.outbox import WebhookProviderIdentifier


class PluginRequestParser(BaseRequestParser):
    provider = "plugin"
    webhook_identifier = WebhookProviderIdentifier.PLUGIN
