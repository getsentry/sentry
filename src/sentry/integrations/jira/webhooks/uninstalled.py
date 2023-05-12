from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.constants import ObjectStatus

from .base import JiraWebhookBase


@control_silo_endpoint
class JiraSentryUninstalledWebhook(JiraWebhookBase):
    """
    Webhook hit by Jira whenever someone uninstalls the Sentry integration from their Jira instance.
    """

    def post(self, request: Request, *args, **kwargs) -> Response:
        integration = kwargs["integration"]

        integration.update(status=ObjectStatus.DISABLED)

        return self.respond()
