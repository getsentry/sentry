from __future__ import absolute_import

from django.contrib.auth import login, logout
from rest_framework.response import Response

from sentry.api.authentication import QuietBasicAuthentication
from sentry.api.base import Endpoint


class AuthIndexEndpoint(Endpoint):
    authentication_classes = [QuietBasicAuthentication]

    def post(self, request):
        if not request.user.is_authenticated():
            return Response(status=400)

        # Must use the real request object that Django knows about
        login(request._request, request.user)

        # TODO: make internal request to UserDetailsEndpoint
        from sentry.api.endpoints.user_details import UserDetailsEndpoint
        endpoint = UserDetailsEndpoint()
        response = endpoint.get(request, user_id=request.user.id)
        return response

    def delete(self, request, *args, **kwargs):
        logout(request._request)
        return Response(status=204)
