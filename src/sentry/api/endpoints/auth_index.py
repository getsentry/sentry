from __future__ import absolute_import

from django.contrib.auth import login, logout
from django.contrib.auth.models import AnonymousUser
from rest_framework.response import Response

from sentry.api import client
from sentry.api.authentication import QuietBasicAuthentication
from sentry.api.base import Endpoint


class AuthIndexEndpoint(Endpoint):
    """
    Manage session authentication

    Intended to be used by the internal Sentry application to handle
    authentication methods from JS endpoints by relying on internal sessions
    and simple HTTP authentication.
    """

    authentication_classes = [QuietBasicAuthentication]

    permission_classes = ()

    # XXX: it's not quite clear if this should be documented or not at
    # this time.
    # doc_section = DocSection.ACCOUNTS

    def post(self, request):
        """
        Authenticate a User
        ```````````````````

        This endpoint authenticates a user using the provided credentials
        through a regular HTTP basic auth system.  The response contains
        cookies that need to be sent with further requests that require
        authentication.

        This is primarily used internally in Sentry.

        Common example::

            curl -X ###METHOD### -u username:password ###URL###
        """
        if not request.user.is_authenticated():
            return Response(status=400)

        # Must use the real request object that Django knows about
        login(request._request, request.user)

        return client.get('/users/me/', request.user, request.auth)

    def delete(self, request, *args, **kwargs):
        """
        Logout the Authenticated User
        `````````````````````````````

        Deauthenticate the currently active session.
        """
        logout(request._request)
        request.user = AnonymousUser()
        return Response(status=204)
