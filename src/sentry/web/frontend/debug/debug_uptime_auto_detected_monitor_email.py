from typing import int
import datetime

from django.http import HttpRequest, HttpResponse
from django.views.generic import View

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


class DebugUptimeAutoDetectedMonitorEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        context = get_context()

        return MailPreview(
            text_template="sentry/emails/uptime/auto-detected-monitors.txt",
            html_template="sentry/emails/uptime/auto-detected-monitors.html",
            context=context,
        ).render(request)
