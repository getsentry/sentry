from __future__ import absolute_import

from sentry.api.views.help_base import ApiHelpBase
from sentry.web.helpers import render_to_response


class ApiHelpPaginationView(ApiHelpBase):
    auth_required = False

    def get(self, request):
        return render_to_response('sentry/help/api_pagination.html', {}, request)
