from urllib.parse import urlencode

from django.conf import settings
from django.views.generic import View

from sentry.models import ProjectKey
from sentry.web.helpers import render_to_response


class DebugErrorPageEmbedView(View):
    def _get_project_key(self):
        return ProjectKey.objects.filter(project=settings.SENTRY_PROJECT)[0]

    def get(self, request):
        context = {
            "query_params": urlencode(
                {
                    "dsn": self._get_project_key().dsn_public,
                    "eventId": "342a3d7f690a49f8bd7c4cf0e61a9ded",
                    **request.GET,
                }
            )
        }

        return render_to_response("sentry/debug/error-page-embed.html", context, request)
