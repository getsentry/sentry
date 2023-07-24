from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from .mail import MailPreview


class DebugNotifyDisableView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        integration_name = "slack"
        integration_link = "https://sentry.io/settings/default/integrations/slack/"
        settings_link = "https://sentry.io/settings/default/integrations/slack/"

        return MailPreview(
            html_template="sentry/integrations/notify-disable.html",
            text_template="sentry/integrations/notify-disable.txt",
            context={
                "integration_name": integration_name,
                "integration_link": integration_link,
                "settings_link": settings_link,
            },
        ).render(request)
