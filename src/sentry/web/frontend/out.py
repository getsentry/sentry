from __future__ import absolute_import

from django.conf import settings
from django.http import Http404, HttpResponseRedirect
from django.views.generic import View

from sentry import options


class OutView(View):
    def get(self, request):
        if not settings.SENTRY_ONPREMISE:
            raise Http404

        install_id = options.get('sentry:install-id')
        if install_id:
            query = '?install_id=' + install_id
        else:
            query = ''
        return HttpResponseRedirect('https://sentry.io/from/self-hosted/' + query)
