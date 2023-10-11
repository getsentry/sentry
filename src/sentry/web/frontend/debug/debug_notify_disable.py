from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.integrations.notify_disable import get_provider_type, get_url
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization

from .mail import MailPreview


class DebugNotifyDisableView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        self.integration, _ = Integration.objects.get_or_create(
            provider="slack",
            external_id="TXXXXXXX",
            name="Awesome Team",
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )

        self.organization = Organization(id=1, slug="organization", name="My Company")

        integration_name = self.integration.provider
        integration_link = get_url(
            self.organization,
            get_provider_type(f"sentry-integration-error:{self.integration.external_id}"),
            self.integration.provider,
        )

        return MailPreview(
            html_template="sentry/integrations/notify-disable.html",
            text_template="sentry/integrations/notify-disable.txt",
            context={
                "integration_name": integration_name.title(),
                "integration_link": integration_link,
            },
        ).render(request)
