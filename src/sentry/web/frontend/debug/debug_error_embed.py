from __future__ import absolute_import

from django.conf import settings
from django.views.generic import View

from sentry.models import ProjectKey, EventMapping
from sentry.web.helpers import render_to_response


class DebugErrorPageEmbedView(View):
    def _get_project_key(self):
        return ProjectKey.objects.filter(
            project=settings.SENTRY_PROJECT,
        )[0]

    def get(self, request):
        context = {
            'dsn': self._get_project_key().dsn_public,
            'event_id': EventMapping.objects.filter(project_id=settings.SENTRY_PROJECT).first().event_id,
        }

        return render_to_response('sentry/debug/error-page-embed.html', context, request)
