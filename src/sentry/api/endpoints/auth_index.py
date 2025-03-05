import logging

from django.contrib.auth import logout
from django.contrib.auth.models import AnonymousUser
from django.utils.http import url_has_allowed_host_and_scheme
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import QuietBasicAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.exceptions import SsoRequired
from sentry.api.serializers import serialize
from sentry.api.validators import AuthVerifyValidator
from sentry.api.validators.auth import MISSING_PASSWORD_OR_U2F_CODE
from sentry.auth.authenticators.u2f import U2fInterface
from sentry.auth.providers.saml2.provider import handle_saml_single_logout
from sentry.auth.services.auth.impl import promote_request_rpc_user
from sentry.auth.superuser import SUPERUSER_ORG_ID
from sentry.organizations.services.organization import organization_service
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.api.serializers.user import DetailedSelfUserSerializer
from sentry.users.models.authenticator import Authenticator
from sentry.utils import auth, json, metrics
from sentry.utils.auth import DISABLE_SSO_CHECK_FOR_LOCAL_DEV, has_completed_sso, initiate_login
from sentry.utils.demo_mode import is_demo_user
from sentry.utils.settings import is_self_hosted

logger: logging.Logger = logging.getLogger(__name__)

PREFILLED_SU_MODAL_KEY = "prefilled_su_modal"


@control_silo_endpoint
class BaseAuthIndexEndpoint(Endpoint):
    """
    Base endpoint to manage session authentication. Shared between
    AuthIndexEndpoint and StaffAuthIndexEndpoint (in getsentry)
    """

    owner = ApiOwner.ENTERPRISE
    authentication_classes = (QuietBasicAuthentication, SessionAuthentication)

    permission_classes = ()

    def get(self, request: Request) -> Response:
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        user = promote_request_rpc_user(request)
        return Response(serialize(user, user, DetailedSelfUserSerializer()))

    @staticmethod
    def _reauthenticate_with_sso(request: Request, org_id: int) -> None:
        """
        If a user without a password is hitting this, it means they need to re-identify with SSO.
        """
        redirect = request.META.get("HTTP_REFERER", None)
        if not url_has_allowed_host_and_scheme(redirect, allowed_hosts=(request.get_host(),)):
            redirect = None
        initiate_login(request, redirect)
        organization_context = organization_service.get_organization_by_id(
            id=org_id, include_teams=False, include_projects=False
        )
        assert organization_context, "Failed to fetch organization in _reauthenticate_with_sso"
        raise SsoRequired(
            organization=organization_context.organization,
            after_login_redirect=redirect,
        )

    @staticmethod
    def _verify_user_via_inputs(validator: AuthVerifyValidator, request: Request) -> bool:
        # See if we have a u2f challenge/response
        if "challenge" in validator.validated_data and "response" in validator.validated_data:
            try:
                interface = Authenticator.objects.get_interface(request.user, "u2f")
                assert isinstance(interface, U2fInterface)
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
                else:
                    metrics.incr("auth.2fa.success", sample_rate=1.0, skip_internal=False)
                return authenticated
            except ValueError as err:
                logger.warning(
                    "u2f_authentication.value_error",
                    extra={"user": request.user.id, "error_message": err},
                )
            except LookupError:
                logger.warning(
                    "u2f_authentication.interface_not_enrolled",
                    extra={"validated_data": validator.validated_data, "user": request.user.id},
                )
        # attempt password authentication
        elif "password" in validator.validated_data:
            authenticated = promote_request_rpc_user(request).check_password(
                validator.validated_data["password"]
            )
            if authenticated:
                metrics.incr("auth.password.success", sample_rate=1.0, skip_internal=False)
            return authenticated
        return False


@control_silo_endpoint
class AuthIndexEndpoint(BaseAuthIndexEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    """
    Manage session authentication

    Intended to be used by the internal Sentry application to handle
    authentication methods from JS endpoints by relying on internal sessions
    and simple HTTP authentication.
    """
    enforce_rate_limit = True
    rate_limits = {
        "PUT": {
            RateLimitCategory.USER: RateLimit(
                limit=5, window=60 * 60
            ),  # 5 PUT requests per hour per user
        }
    }

    def _validate_superuser(
        self, validator: AuthVerifyValidator, request: Request, verify_authenticator: bool
    ) -> bool:
        """
        For a superuser, they need to be validated before we can grant an active superuser session.
        If the user has a password or u2f device, authenticate the password/challenge that was sent is valid.
        If the user doesn't have a password or u2f device, we say they're authenticated if they have a
        valid SSO session.

        By nature of granting an active superuser session, we want to make sure that the user has completed
        SSO and if they do not, we redirect them back to the SSO login.

        """
        logger.info(
            "auth-index.validate_superuser",
            extra={
                "user": request.user.id,
                "raise_exception": not DISABLE_SSO_CHECK_FOR_LOCAL_DEV,
                "verify_authenticator": verify_authenticator,
            },
        )
        # Disable exception for missing password or u2f code if we're running locally
        validator.is_valid(raise_exception=not DISABLE_SSO_CHECK_FOR_LOCAL_DEV)

        authenticated = (
            self._verify_user_via_inputs(validator, request)
            if (not DISABLE_SSO_CHECK_FOR_LOCAL_DEV and verify_authenticator) or is_self_hosted()
            else True
        )

        if SUPERUSER_ORG_ID:
            if not has_completed_sso(request, SUPERUSER_ORG_ID):
                request.session[PREFILLED_SU_MODAL_KEY] = request.data
                self._reauthenticate_with_sso(request, SUPERUSER_ORG_ID)

        return authenticated

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

        if is_demo_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        # If 2fa login is enabled then we cannot sign in with username and
        # password through this api endpoint.
        if request.user.has_2fa():
            return Response(
                {
                    "2fa_required": True,
                    "message": "Cannot sign-in with password authentication when 2fa is enabled.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            # Must use the real request object that Django knows about
            auth.login(request._request, promote_request_rpc_user(request))
        except auth.AuthUserPasswordExpired:
            return Response(
                {
                    "message": "Cannot sign-in with password authentication because password has expired."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        request.user = request._request.user

        return self.get(request)

    def put(self, request: Request) -> Response:
        """
        Verify a User
        `````````````

        This endpoint verifies the currently authenticated user (for example, to gain superuser)
        through 3 methods (password and u2f device (provided in the request data) and valid sso
        session if the user is a superuser). If the request is from the superuser modal and the
        current superuser is verified, superuser access is granted.

        :auth: required
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        validator = AuthVerifyValidator(data=request.data)

        if not (request.user.is_superuser and request.data.get("isSuperuserModal")):
            try:
                validator.is_valid(raise_exception=True)
            except ValidationError:
                return Response({"detail": {"code": MISSING_PASSWORD_OR_U2F_CODE}}, status=400)

            authenticated = self._verify_user_via_inputs(validator, request)
        else:
            verify_authenticator = False

            if not DISABLE_SSO_CHECK_FOR_LOCAL_DEV and not is_self_hosted():
                if SUPERUSER_ORG_ID:
                    verify_authenticator = organization_service.check_organization_by_id(
                        id=SUPERUSER_ORG_ID, only_visible=False
                    )

                if verify_authenticator:
                    if not Authenticator.objects.filter(
                        user_id=request.user.id, type=U2fInterface.type
                    ).exists():
                        return Response(
                            {"detail": {"code": "no_u2f"}}, status=status.HTTP_403_FORBIDDEN
                        )
                logger.info(
                    "auth-index.put",
                    extra={
                        "organization": SUPERUSER_ORG_ID,
                        "user": request.user.id,
                        "verify_authenticator": verify_authenticator,
                    },
                )
            try:
                authenticated = self._validate_superuser(validator, request, verify_authenticator)
            except ValidationError:
                return Response({"detail": {"code": MISSING_PASSWORD_OR_U2F_CODE}}, status=400)

        if not authenticated:
            return Response({"detail": {"code": "ignore"}}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Must use the httprequest object instead of request
            auth.login(request._request, promote_request_rpc_user(request))
            metrics.incr(
                "sudo_modal.success",
            )
        except auth.AuthUserPasswordExpired:
            metrics.incr(
                "sudo_modal.failure",
            )
            return Response(
                {
                    "code": "password-expired",
                    "message": "Cannot sign-in with basic auth because password has expired.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.user.is_superuser and request.data.get("isSuperuserModal"):
            request.superuser.set_logged_in(request.user)

        request.user = request._request.user

        return self.get(request)

    def delete(self, request: Request, *args, **kwargs) -> Response:
        """
        Logout the Authenticated User
        `````````````````````````````

        Deauthenticate all active sessions for this user.
        """

        # Allows demo user to log out from its current session but not others
        if is_demo_user(request.user) and request.data.get("all", None) is True:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # If there is an SLO URL, return it to frontend so the browser can redirect
        # the user back to the IdP site to delete the IdP session cookie
        slo_url = handle_saml_single_logout(request)

        # For signals to work here, we must promote the request.user to a full user object
        logout(request._request)
        request.user = AnonymousUser()

        if slo_url:
            return Response(status=status.HTTP_200_OK, data={"sloUrl": slo_url})
        return Response(status=status.HTTP_204_NO_CONTENT)
