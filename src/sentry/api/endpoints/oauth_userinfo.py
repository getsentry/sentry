from rest_framework import status
from rest_framework.authentication import get_authorization_header
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.exceptions import ParameterValidationError, ResourceDoesNotExist, SentryAPIException
from sentry.models.apitoken import ApiToken
from sentry.models.useremail import UserEmail


class InsufficientScopesError(SentryAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    code = "insufficient-scope"
    message = "openid scope is required for userinfo access"


@control_silo_endpoint
class OAuthUserInfoEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.ENTERPRISE
    authentication_classes = ()
    permission_classes = ()

    def get(self, request: Request) -> Response:
        try:
            access_token = get_authorization_header(request).split()[1].decode("utf-8")
        except IndexError:
            raise ParameterValidationError("Bearer token not found in authorization header")
        try:
            token_details = ApiToken.objects.get(token=access_token)
        except ApiToken.DoesNotExist:
            raise ResourceDoesNotExist("Access token not found")

        scopes = token_details.get_scopes()
        if "openid" not in scopes:
            raise InsufficientScopesError

        user = token_details.user
        user_output = {"sub": user.id}
        if "profile" in scopes:
            profile_details = {
                "name": user.name,
                "avatar_type": user.avatar_type,
                "avatar_url": user.avatar_url,
                "date_joined": user.date_joined,
            }
            user_output.update(profile_details)
        if "email" in scopes:
            email = UserEmail.objects.get(user=user)
            email_details = {"email": email.email, "email_verified": email.is_verified}
            user_output.update(email_details)
        return Response(user_output)
