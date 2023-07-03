from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.models import ApiToken, UserEmail


@control_silo_endpoint
class OAuthUserInfoEndpoint(Endpoint):
    permission_classes: tuple = ()

    def post(self, request: Request) -> Response:
        # TODO(EricHasegawa) pass in the access token properly:
        try:
            access_token = request.data["access_token"]
        except KeyError:
            return Response("No access token found.", status=401)
        token_details = ApiToken.objects.get(token=access_token)
        scopes = token_details.get_scopes()
        if "openid" not in scopes:
            return Response(status=403)

        user = token_details.user
        user_output = {"sub": user.id}
        if "profile" in scopes:
            # TODO(EricHasegawa): Find fields and add if applicable: Website, gender, birthday, locale, last_updated, timezone.
            user_output["name"] = user.name
            user_output["username"]: user.username
            user_output["avatar_type"] = user.avatar_type
            user_output["avatar_url"] = user.avatar_url
            user_output["date_joined"] = user.date_joined
        if "email" in scopes:
            try:
                email = UserEmail.objects.get(user=user)
                user_output["email"] = email.email
                user_output["email_verified"] = email.is_verified
            except UserEmail.DoesNotExist:
                user_output["email"] = None
                user_output["email_verified"] = None
        if "address" in scopes:
            # TODO(EricHasegawa): Find out if we store physical address and add here if so.
            pass
        if "phone" in scopes:
            # TODO(EricHasegawa): Find out if we store phone number and add here if so.
            pass
        return Response(user_output)
