from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.constants import SentryAppStatus
from sentry.integrations.notify_disable import get_provider_type, get_url
from sentry.models import Organization, SentryApp

from .mail import MailPreview


class DebugNotifyDisableView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        self.organization = Organization(id=1, slug="organization", name="My Company")
        self.sentry_app = SentryApp(
            name="Test App",
            events=["issue.resolved", "issue.ignored", "issue.assigned"],
            status=SentryAppStatus.INTERNAL,
            webhook_url="https://broken-example.com/webhook",
        )

        integration_name = self.sentry_app.name
        integration_link = get_url(
            self.organization,
            get_provider_type(f"sentry-app-error:{self.sentry_app.uuid}"),
            self.sentry_app.slug,
        )
        redis_key = f"sentry-app-error:{self.sentry_app.uuid}"

        return MailPreview(
            html_template="sentry/integrations/sentry-app-notify-disable.html",
            text_template="sentry/integrations/sentry-app-notify-disable.txt",
            context={
                "integration_name": integration_name,
                "integration_link": integration_link,
                "webhook_url": self.sentry_app.webhook_url
                if "sentry-app" in redis_key and self.sentry_app.webhook_url
                else "",
            },
        ).render(request)
