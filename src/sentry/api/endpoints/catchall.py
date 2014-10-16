from __future__ import absolute_import

from django.http import HttpResponse
from django.views.generic import View


class CatchallEndpoint(View):
    def get(self, request):
        return HttpResponse(status=404)

    post = get
    put = get
    delete = get
    patch = get
    options = get
    head = get
