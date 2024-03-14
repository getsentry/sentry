import datetime

from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from .mail import MailPreview


def get_context():
    date = datetime.datetime(2024, 1, 1, 0, 0, tzinfo=datetime.UTC)
    return {
        "broken_monitors": [("Dummy Cron Monitor", "#", date), ("Example Cron Monitor", "#", date)],
        "view_monitors_link": "#",
    }


class DebugCronBrokenMonitorEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        context = get_context()

        return MailPreview(
            text_template="sentry/emails/crons/broken-monitors.txt",
            html_template="sentry/emails/crons/broken-monitors.html",
            context=context,
        ).render(request)
