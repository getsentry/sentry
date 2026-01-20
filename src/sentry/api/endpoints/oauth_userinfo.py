from rest_framework import status
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import APIException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.models.apitoken import ApiToken
from sentry.users.models.useremail import UserEmail


class BearerTokenError(APIException):
    """Base class for RFC 6750 Bearer token errors."""

    auth_header: str = 'Bearer realm="api"'


class BearerTokenMissing(BearerTokenError):
    """
    401 when no auth or unsupported scheme - RFC 6750 Section 3.1.

    Per RFC 6750: "If the request lacks any authentication information
    (e.g., the client was unaware that authentication is necessary or
    attempted using an unsupported authentication method), the resource
    server SHOULD NOT include an error code or other error information."
    """

    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Bearer token required"


class BearerTokenInvalid(BearerTokenError):
    """
    401 when token is invalid/expired - RFC 6750 Section 3.1.

    Per RFC 6750: "invalid_token - The access token provided is expired,
    revoked, malformed, or invalid for other reasons."
    """

    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = {"error": "invalid_token", "error_description": "Access token not found"}
    auth_header = 'Bearer realm="api", error="invalid_token"'


class BearerTokenInsufficientScope(BearerTokenError):
    """
    403 when token lacks required scope - RFC 6750 Section 3.1.

    Per RFC 6750: "insufficient_scope - The request requires higher privileges
    than provided by the access token."
    """

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = {
        "error": "insufficient_scope",
        "error_description": "openid scope is required",
    }
    auth_header = 'Bearer realm="api", error="insufficient_scope", scope="openid"'


@control_silo_endpoint
class OAuthUserInfoEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    authentication_classes = ()
    permission_classes = ()

    def get(self, request: Request) -> Response:
        auth_header = get_authorization_header(request).split()

        if len(auth_header) < 2:
            raise BearerTokenMissing()

        scheme = auth_header[0].decode("utf-8")
        if scheme.lower() != "bearer":
            raise BearerTokenMissing()

        access_token = auth_header[1].decode("utf-8")
        try:
            token_details = ApiToken.objects.get(token=access_token)
        except ApiToken.DoesNotExist:
            raise BearerTokenInvalid()

        scopes = token_details.get_scopes()
        if "openid" not in scopes:
            raise BearerTokenInsufficientScope()

        user = token_details.user
        user_output: dict[str, object] = {"sub": user.id}
        if "profile" in scopes:
            user_output.update(
                {
                    "name": user.name,
                    "avatar_type": user.avatar_type,
                    "avatar_url": user.avatar_url,
                    "date_joined": user.date_joined,
                }
            )
        if "email" in scopes:
            email = UserEmail.objects.get_primary_email(user)
            user_output.update({"email": email.email, "email_verified": email.is_verified})
        return Response(user_output)
