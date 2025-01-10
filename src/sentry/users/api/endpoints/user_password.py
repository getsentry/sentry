from typing import Any

from django.utils.crypto import constant_time_compare
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.auth import password_validation
from sentry.security.utils import capture_security_activity
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.models.user import User
from sentry.web.frontend.twofactor import reset_2fa_rate_limits


class UserPasswordSerializer(serializers.Serializer[User]):
    password = serializers.CharField(required=True, trim_whitespace=False)
    passwordNew = serializers.CharField(required=True, trim_whitespace=False)
    passwordVerify = serializers.CharField(required=True, trim_whitespace=False)

    def validate_password(self, value: str) -> str:
        user = self.context["user"]
        if not user.check_password(value):
            raise serializers.ValidationError("The password you entered is not correct.")
        return value

    def validate_passwordNew(self, value: str) -> str:
        # this will raise a ValidationError if password is invalid
        user = self.context["user"]
        password_validation.validate_password(value, user=user)

        if user.is_managed:
            raise serializers.ValidationError(
                "This account is managed and the password cannot be changed via Sentry."
            )

        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)

        # make sure `passwordNew` matches `passwordVerify`
        if not constant_time_compare(
            str(attrs.get("passwordNew")), str(attrs.get("passwordVerify"))
        ):
            raise serializers.ValidationError("The passwords you entered did not match.")

        return attrs


@control_silo_endpoint
class UserPasswordEndpoint(UserEndpoint):
    owner = ApiOwner.SECURITY
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }

    enforce_rate_limit = True
    rate_limits = {
        "PUT": {
            RateLimitCategory.USER: RateLimit(
                limit=5, window=60 * 60
            ),  # 5 PUT requests per hour per user
        }
    }

    def put(self, request: Request, user: User) -> Response:
        # pass some context to serializer otherwise when we create a new serializer instance,
        # user.password gets set to new plaintext password from request and
        # `user.has_usable_password` becomes False
        serializer = UserPasswordSerializer(data=request.data, context={"user": user})

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result = serializer.validated_data

        user.set_password(result["passwordNew"])
        user.refresh_session_nonce(request._request)
        user.clear_lost_passwords()
        user.save()

        capture_security_activity(
            account=user,
            type="password-changed",
            actor=request.user,
            ip_address=request.META["REMOTE_ADDR"],
            send_email=True,
        )

        reset_2fa_rate_limits(user.id)

        return Response(status=status.HTTP_204_NO_CONTENT)
