from __future__ import absolute_import

from django.contrib.auth import login, logout
from rest_framework.response import Response

from sentry.api.authentication import QuietBasicAuthentication
from sentry.api.base import DocSection, Endpoint


class AuthIndexEndpoint(Endpoint):
    """
    Manage session authentication

    Intended to be used by the internal Sentry application to handle
    authentication methods from JS endpoints by relying on internal sessions
    and simple HTTP authentication.
    """

    authentication_classes = [QuietBasicAuthentication]

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

        # TODO: make internal request to UserDetailsEndpoint
        from sentry.api.endpoints.user_details import UserDetailsEndpoint
        endpoint = UserDetailsEndpoint()
        response = endpoint.get(request, user_id=request.user.id)
        return response

    def delete(self, request, *args, **kwargs):
        """
        Logout the authenticated user

        Deauthenticate the currently active session.

            {method} {path}

        """
        logout(request._request)
        return Response(status=204)
