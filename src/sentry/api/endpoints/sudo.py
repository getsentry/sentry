from __future__ import absolute_import

from django.contrib import auth
from rest_framework.response import Response
from sudo.utils import grant_sudo_privileges

from sentry.api.base import Endpoint


class SudoEndpoint(Endpoint):
    permission_classes = ()

    def post(self, request):
        if auth.authenticate(username=request.user.email, password=request.DATA.get('password')):
            grant_sudo_privileges(request._request)
            return Response(status=200)
