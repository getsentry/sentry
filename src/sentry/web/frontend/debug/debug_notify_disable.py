from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.models import Organization, OrganizationMember, User
from sentry.tasks.integrations.disabled_notif import IntegrationBrokenNotification

from .mail import COMMIT_EXAMPLE, MailPreview


class DebugNotifyDisableView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        org = Organization(id=1, slug="default", name="Default")
        integration_name = "slack"
        integration_link = "https://sentry.io/settings/default/integrations/slack/"
        settings_link = "https://sentry.io/settings/default/integrations/slack/"

        return MailPreview(
            html_template="sentry/integrations/notify-disable.html",
            text_template="sentry/integrations/notify-disable.txt",
            context={"integration_name":integration_name,
            "integration_link":integration_link,
            "settings_link":settings_link
            }).render(request)
