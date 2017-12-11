from __future__ import absolute_import

import json

from django.contrib import auth
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from sudo.utils import grant_sudo_privileges

from sentry.api.base import Endpoint
from sentry.models import Authenticator


class SudoEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def post(self, request):
        authenticated = False

        # try u2f auth
        if 'challenge' in request.DATA and 'response' in request.DATA:
            try:
                # `get_interface` raises `LookupError` if interface doesn't exist
                interface = Authenticator.objects.get_interface(request.user, 'u2f')
                if not interface.is_enrolled:
                    raise LookupError()
            except LookupError:
                pass
            else:
                try:
                    challenge = json.loads(request.DATA['challenge'])
                    response = json.loads(request.DATA['response'])
                    authenticated = interface.validate_response(request, challenge, response)
                except ValueError:
                    pass

        else:
            authenticated = auth.authenticate(
                username=request.user.email,
                password=request.DATA.get('password'))

        if authenticated:
            grant_sudo_privileges(request._request)
            return Response(status=200)

        return Response({'allowFail': True}, content_type="application/json", status=401)
