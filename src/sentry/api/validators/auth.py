from typing import NotRequired, TypedDict

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from sentry import newsletter
from sentry.auth import password_validation
from sentry.users.models.user import User
from sentry.utils.dates import get_timezone_choices
from sentry.utils.email.address import is_valid_email_address

MISSING_PASSWORD_OR_U2F_CODE = "missing_password_or_u2f"
EMAIL_ALREADY_REGISTERED = _("An account is already registered with that email address.")


class RegistrationRequest(TypedDict):
    email: str
    name: str
    password: str
    subscribe: NotRequired[bool]
    timezone: NotRequired[str]


class AuthVerifyValidator(serializers.Serializer):
    password = serializers.CharField(required=False, trim_whitespace=False)
    # For u2f
    challenge = serializers.CharField(required=False, trim_whitespace=False)
    response = serializers.CharField(required=False, trim_whitespace=False)

    def validate(self, data):
        if "password" in data:
            return data
        if "challenge" in data and "response" in data:
            return data
        raise serializers.ValidationError(
            detail="You must provide `password` or `challenge` and `response`.",
            code=MISSING_PASSWORD_OR_U2F_CODE,
        )


class RegistrationValidator(serializers.Serializer[RegistrationRequest]):
    email = serializers.EmailField(max_length=128)
    name = serializers.CharField(max_length=200)
    password = serializers.CharField(trim_whitespace=False)
    subscribe = serializers.BooleanField(required=True)
    timezone = serializers.ChoiceField(
        choices=get_timezone_choices(), required=False, allow_blank=True
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not newsletter.backend.is_enabled():
            self.fields.pop("subscribe")

    def validate_email(self, value: str) -> str:
        if not is_valid_email_address(value):
            raise serializers.ValidationError(_("Enter a valid email address."))
        if User.objects.filter(
            Q(username__iexact=value) | Q(email__iexact=value) | Q(email_unique__iexact=value)
        ).exists():
            raise serializers.ValidationError(EMAIL_ALREADY_REGISTERED)
        return value.lower()

    def validate(self, data: RegistrationRequest) -> RegistrationRequest:
        try:
            password_validation.validate_password(data["password"], user=User(email=data["email"]))
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages}) from error
        return data
