from __future__ import absolute_import

from django.contrib.auth import logout
from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response

from sentry.api.authentication import QuietBasicAuthentication
from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.api.validators import AuthVerifyValidator
from sentry.models import Authenticator
from sentry.utils import auth
from sentry.utils.functional import extract_lazy_object


class AuthIndexEndpoint(Endpoint):
    """
    Manage session authentication

    Intended to be used by the internal Sentry application to handle
    authentication methods from JS endpoints by relying on internal sessions
    and simple HTTP authentication.
    """

    authentication_classes = [
        QuietBasicAuthentication,
        SessionAuthentication,
    ]

    permission_classes = ()

    # XXX: it's not quite clear if this should be documented or not at
    # this time.
    # doc_section = DocSection.ACCOUNTS

    def get(self, request):
        if not request.user.is_authenticated():
            return Response(status=400)

        user = extract_lazy_object(request._request.user)
        data = serialize(user, user)
        # XXX(dcramer): we dont use is_active_superuser here as we simply
        # want to tell the UI that we're an authenticated superuser, and
        # for requests that require an *active* session, they should prompt
        # on-demand. This ensures things like links to the Sentry admin can
        # still easily be rendered.
        data['isSuperuser'] = user.is_superuser
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
            return Response(
                {
                    '2fa_required': True,
                    'message': 'Cannot sign-in with basic auth when 2fa is enabled.'
                },
                status=403
            )

        try:
            # Must use the real request object that Django knows about
            auth.login(request._request, request.user)
        except auth.AuthUserPasswordExpired:
            return Response(
                {
                    'message': 'Cannot sign-in with basic auth because password has expired.',
                },
                status=403
            )

        request.user = request._request.user

        return self.get(request)

    def put(self, request):
        """
        Verify a User
        `````````````

        This endpoint verifies the currently authenticated user (for example, to gain superuser).

        :auth: required
        """
        if not request.user.is_authenticated():
            return Response(status=401)

        validator = AuthVerifyValidator(data=request.DATA)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        if not request.user.check_password(validator.object['password']):
            return Response(status=403)

        try:
            # Must use the real request object that Django knows about
            auth.login(request._request, request.user)
        except auth.AuthUserPasswordExpired:
            return Response(
                {
                    'message': 'Cannot sign-in with basic auth because password has expired.',
                },
                status=403
            )

        request.user = request._request.user

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
