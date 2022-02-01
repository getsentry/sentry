import logging

from django.contrib.auth import logout
from django.contrib.auth.models import AnonymousUser
from django.utils.http import is_safe_url
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import QuietBasicAuthentication
from sentry.api.base import Endpoint
from sentry.api.exceptions import SsoRequired
from sentry.api.serializers import DetailedUserSerializer, serialize
from sentry.api.validators import AuthVerifyValidator
from sentry.auth.superuser import Superuser, is_active_superuser
from sentry.models import Authenticator, Organization
from sentry.utils import auth, json
from sentry.utils.auth import initiate_login
from sentry.utils.functional import extract_lazy_object

logger: logging.Logger = logging.getLogger(__name__)


class AuthIndexEndpoint(Endpoint):
    """
    Manage session authentication

    Intended to be used by the internal Sentry application to handle
    authentication methods from JS endpoints by relying on internal sessions
    and simple HTTP authentication.
    """

    authentication_classes = [QuietBasicAuthentication, SessionAuthentication]

    permission_classes = ()

    def get(self, request: Request) -> Response:
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        user = extract_lazy_object(request._request.user)
        return Response(serialize(user, user, DetailedUserSerializer()))

    def post(self, request: Request) -> Response:
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
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        # If 2fa login is enabled then we cannot sign in with username and
        # password through this api endpoint.
        if Authenticator.objects.user_has_2fa(request.user):
            return Response(
                {
                    "2fa_required": True,
                    "message": "Cannot sign-in with password authentication when 2fa is enabled.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            # Must use the real request object that Django knows about
            auth.login(request._request, request.user)
        except auth.AuthUserPasswordExpired:
            return Response(
                {
                    "message": "Cannot sign-in with password authentication because password has expired."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        request.user = request._request.user

        return self.get(request)

    def put(self, request: Request):
        """
        Verify a User
        `````````````

        This endpoint verifies the currently authenticated user (for example, to gain superuser).

        :auth: required
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        validator = AuthVerifyValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        authenticated = False
        # See if we have a u2f challenge/response
        if "challenge" in validator.validated_data and "response" in validator.validated_data:
            try:
                interface = Authenticator.objects.get_interface(request.user, "u2f")
                if not interface.is_enrolled():
                    raise LookupError()
                challenge = json.loads(validator.validated_data["challenge"])
                response = json.loads(validator.validated_data["response"])
                authenticated = interface.validate_response(request, challenge, response)
                if not authenticated:
                    logger.warning(
                        "u2f_authentication.verification_failed",
                        extra={"user": request.user.id},
                    )
            except ValueError as err:
                logger.warning(
                    "u2f_authentication.value_error",
                    extra={"user": request.user.id, "error_message": err},
                )
                pass
            except LookupError:
                logger.warning(
                    "u2f_authentication.interface_not_enrolled",
                    extra={"validated_data": validator.validated_data, "user": request.user.id},
                )
                pass

        # attempt password authentication
        else:
            authenticated = request.user.check_password(validator.validated_data["password"])

        # UI treats 401s by redirecting, this 401 should be ignored
        if not authenticated:
            return Response({"detail": {"code": "ignore"}}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Must use the real request object that Django knows about
            auth.login(request._request, request.user)
        except auth.AuthUserPasswordExpired:
            return Response(
                {
                    "code": "password-expired",
                    "message": "Cannot sign-in with basic auth because password has expired.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.user.is_superuser and not is_active_superuser(request) and Superuser.org_id:
            # if a superuser hitting this endpoint is not active, they are most likely
            # trying to become active, and likely need to re-identify with SSO to do so.
            redirect = request.META.get("HTTP_REFERER", "")
            if not is_safe_url(redirect, allowed_hosts=(request.get_host(),)):
                redirect = None

            initiate_login(request, redirect)
            raise SsoRequired(Organization.objects.get_from_cache(id=Superuser.org_id))

        request.user = request._request.user

        return self.get(request)

    def delete(self, request: Request, *args, **kwargs) -> Response:
        """
        Logout the Authenticated User
        `````````````````````````````

        Deauthenticate all active sessions for this user.
        """
        logout(request._request)
        request.user = AnonymousUser()
        return Response(status=status.HTTP_204_NO_CONTENT)
