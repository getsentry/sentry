from __future__ import absolute_import

from django.contrib.auth import login, logout
from rest_framework.response import Response

from sentry.api import client
from sentry.api.authentication import QuietBasicAuthentication
from sentry.api.base import DocSection, Endpoint
from sentry.models import AnonymousUser


class AuthIndexEndpoint(Endpoint):
    """
    Manage session authentication

    Intended to be used by the internal Sentry application to handle
    authentication methods from JS endpoints by relying on internal sessions
    and simple HTTP authentication.
    """

    authentication_classes = [QuietBasicAuthentication]

    permission_classes = ()

    doc_section = DocSection.ACCOUNTS

    def post(self, request):
        """
        Authenticate a user

        Authenticate a user using the provided credentials.

            curl -X {method} -u PUBLIC_KEY:SECRET_KEY {path}

        """
        if not request.user.is_authenticated():
            return Response(status=400)

        # Must use the real request object that Django knows about
        login(request._request, request.user)

        return client.get('/users/me/', request.user, request.auth)

    def delete(self, request, *args, **kwargs):
        """
        Logout the authenticated user

        Deauthenticate the currently active session.

            {method} {path}

        """
        logout(request._request)
        request.user = AnonymousUser()
        return Response(status=204)
