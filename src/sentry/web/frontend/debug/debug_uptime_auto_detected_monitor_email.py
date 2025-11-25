import datetime

from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.web.frontend.base import internal_region_silo_view

from .mail import MailPreview


def get_context():
    date = datetime.datetime(2025, 1, 16, 10, 30, tzinfo=datetime.UTC)
    return {
        "monitor_url_display": "https://api.example.com",
        "monitor_detail_url": "#",
        "project_slug": "my-project",
        "date_created": date,
        "view_monitors_link": "#",
    }


@internal_region_silo_view
class DebugUptimeAutoDetectedMonitorEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        context = get_context()

        return MailPreview(
            text_template="sentry/emails/uptime/auto-detected-monitors.txt",
            html_template="sentry/emails/uptime/auto-detected-monitors.html",
            context=context,
        ).render(request)
