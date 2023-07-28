from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry import integrations
from sentry.integrations.notifydisable import get_provider_type, get_url
from sentry.models import Integration
from sentry.testutils import TestCase

from .mail import MailPreview


class DebugNotifyDisableView(View, TestCase):
    def get(self, request: HttpRequest) -> HttpResponse:
        self.integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX3",
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )

        self.organization = self.create_organization(owner=self.user)

        provider = integrations.get(self.integration.provider)
        integration_name = provider.name
        integration_link = get_url(
            self.organization,
            get_provider_type(self.integration._get_redis_key()),
            self.integration.provider,
        )

        return MailPreview(
            html_template="sentry/integrations/notify-disable.html",
            text_template="sentry/integrations/notify-disable.txt",
            context={
                "integration_name": integration_name,
                "integration_link": integration_link,
            },
        ).render(request)
