from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry import integrations
from sentry.integrations.notify_disable import get_provider_type, get_url
from sentry.models import Integration, Organization

from .mail import MailPreview


class DebugNotifyDisableView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        self.integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )

        self.organization = Organization(id=1, slug="organization", name="My Company")

        provider = integrations.get(self.integration.provider)
        integration_name = provider.name
        integration_link = get_url(
            self.organization,
            get_provider_type(f"sentry-integration-error:{self.integration.external_id}"),
            provider.name,
        )

        return MailPreview(
            html_template="sentry/integrations/notify-disable.html",
            text_template="sentry/integrations/notify-disable.txt",
            context={
                "integration_name": integration_name,
                "integration_link": integration_link,
            },
        ).render(request)
