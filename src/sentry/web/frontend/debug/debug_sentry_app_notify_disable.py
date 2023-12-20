from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.constants import SentryAppStatus
from sentry.integrations.notify_disable import get_provider_type, get_url
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.organization import Organization

from .mail import MailPreview


class DebugSentryAppNotifyDisableView(View):
    def get(self, request: HttpRequest) -> HttpResponse:

        self.organization = Organization(id=1, slug="sentry", name="My Company")
        self.sentry_app = SentryApp(
            name="Test App",
            events=["issue.resolved", "issue.ignored", "issue.assigned"],
            status=SentryAppStatus.INTERNAL,
            webhook_url="https://broken-example.com/webhook",
            slug="internal-35e455",
        )
        self.install = SentryAppInstallation(
            organization_id=self.organization.id, sentry_app=self.sentry_app
        )

        redis_key = f"sentry-app-error:{self.install.uuid}"
        integration_name = self.sentry_app.name
        integration_link = get_url(
            self.organization,
            get_provider_type(redis_key),
            self.sentry_app.slug,
        )
        return MailPreview(
            html_template="sentry/integrations/sentry-app-notify-disable.html",
            text_template="sentry/integrations/sentry-app-notify-disable.txt",
            context={
                "integration_name": integration_name,
                "integration_link": integration_link,
                "webhook_url": self.sentry_app.webhook_url
                if "sentry-app" in redis_key and self.sentry_app.webhook_url
                else "",
                "dashboard_link": f"{integration_link}dashboard/",
            },
        ).render(request)
