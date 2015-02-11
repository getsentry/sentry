from __future__ import absolute_import

from django.conf import settings

from sentry.api.views.help_base import ApiHelpBase
from sentry.web.helpers import render_to_response


class ApiHelpIndexView(ApiHelpBase):
    auth_required = False

    def get(self, request):
        prefix = '/api/0/'

        context = {
            'section_list': self.get_sections(prefix),
            'SENTRY_URL_PREFIX': settings.SENTRY_URL_PREFIX,
        }

        return render_to_response('sentry/help/api_index.html', context, request)
