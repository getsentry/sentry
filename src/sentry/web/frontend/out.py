from django.http import Http404, HttpResponseRedirect
from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.utils.settings import is_self_hosted


class OutView(View):
    def get(self, request: Request) -> Response:
        if not is_self_hosted():
            raise Http404

        install_id = options.get("sentry:install-id")
        if install_id:
            query = "?install_id=" + install_id
        else:
            query = ""
        return HttpResponseRedirect("https://sentry.io/from/self-hosted/" + query)
