from rest_framework.authentication import get_authorization_header
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.models import ApiToken, UserEmail


@control_silo_endpoint
class OAuthUserInfoEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request: Request) -> Response:
        try:
            access_token = get_authorization_header(request).split()[1].decode("utf-8")
        except IndexError:
            return Response("No access token found.", status=401)
        try:
            token_details = ApiToken.objects.get(token=access_token)
        except ApiToken.DoesNotExist:
            return Response(status=400)

        scopes = token_details.get_scopes()
        if "openid" not in scopes:
            return Response(status=403)

        user = token_details.user
        user_output = {"sub": user.id}
        if "profile" in scopes:
            user_output["name"] = user.name
            user_output["avatar_type"] = user.avatar_type
            user_output["avatar_url"] = user.avatar_url
            user_output["date_joined"] = user.date_joined
        if "email" in scopes:
            email = UserEmail.objects.get(user=user)
            user_output["email"] = email.email
            user_output["email_verified"] = email.is_verified
        return Response(user_output)
