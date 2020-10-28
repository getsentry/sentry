from __future__ import absolute_import

import six

from django.conf import settings
from django.views.generic import View
from six.moves.urllib.parse import urlencode

from sentry.models import ProjectKey
from sentry.web.helpers import render_to_response


class DebugErrorPageEmbedView(View):
    def _get_project_key(self):
        return ProjectKey.objects.filter(project=settings.SENTRY_PROJECT)[0]

    def get(self, request):
        context = {
            "dsn": self._get_project_key().dsn_public,
            "event_id": "342a3d7f690a49f8bd7c4cf0e61a9ded",
            "options": urlencode({k: v for k, v in six.iteritems(request.GET)}),
        }

        return render_to_response("sentry/debug/error-page-embed.html", context, request)
