from __future__ import absolute_import

from django.contrib.auth import logout
from django.contrib.auth.models import AnonymousUser
from rest_framework.response import Response

from sentry.api.authentication import QuietBasicAuthentication
from sentry.models import Authenticator
from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.utils import auth


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

    def get(self, request):
        if not request.user.is_authenticated():
            return Response(status=400)

        data = serialize(request.user, request.user)
        data['isSuperuser'] = request.is_superuser()
        return Response(data)

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

        # If 2fa login is enabled then we cannot sign in with username and
        # password through this api endpoint.
        if Authenticator.objects.user_has_2fa(request.user):
            return Response({
                '2fa_required': True,
                'message': 'Cannot sign-in with basic auth when 2fa is enabled.'
            }, status=403)

        try:
            # Must use the real request object that Django knows about
            auth.login(request._request, request.user)
        except auth.AuthUserPasswordExpired:
            return Response({
                'message': 'Cannot sign-in with basic auth because password has expired.',
            }, status=403)

        return self.get(request)

    def delete(self, request, *args, **kwargs):
        """
        Logout the Authenticated User
        `````````````````````````````

        Deauthenticate the currently active session.
        """
        logout(request._request)
        request.user = AnonymousUser()
        return Response(status=204)
