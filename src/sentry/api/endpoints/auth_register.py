import logging

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from sentry import newsletter, options
from sentry.api.base import Endpoint
from sentry.api.serializers.base import serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.app import ratelimiter
from sentry.auth import password_validation
from sentry.models import User
from sentry.signals import user_signup
from sentry.utils import auth, metrics

logger = logging.getLogger("sentry.auth")
audit_logger = logging.getLogger("sentry.audit.ui")

ERR_UNKNOWN = "An unknown error occurred while creating the account."


class AuthRegisterSerializer(CamelSnakeSerializer):
    name = serializers.CharField(max_length=30, required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)
    subscribe = serializers.BooleanField(required=False)
    referrer = serializers.CharField(required=False)

    def is_rate_limited(self):
        limit = options.get("auth.ip-rate-limit")
        if not limit:
            return False

        ip_address = self.context["request"].META["REMOTE_ADDR"]
        return ratelimiter.is_limited(f"auth:ip:{ip_address}", limit)

    def validate_email(self, value):
        value = value.strip()
        if not value:
            return
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "An account is already registered with that email address."
            )
        return value.lower()

    def validate_password(self, value):
        try:
            password_validation.validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages[0])
        return value

    def validate(self, data):
        if self.is_rate_limited():
            raise serializers.ValidationError("Rate limit exceeded")

        return data

    def create(self, data) -> User:
        request = self.context["request"]

        user = User(username=data["email"], email=data["email"], name=data["name"])
        user.set_password(data["password"])
        user.save()

        # Authenticate user into the current request context
        #
        # XXX: This is a side-effect, which is maybe a little confusing as
        #      creation of an account using this serializer will also
        #      authenticate the created user.
        user.backend = settings.AUTHENTICATION_BACKENDS[0]
        assert auth.login(request, user)

        if newsletter.is_enabled() and data.get("subscribe"):
            newsletter.create_or_update_subscriptions(
                user, list_ids=newsletter.get_default_list_ids()
            )

        for email in user.emails.filter(is_verified=False):
            user.send_confirm_email_singular(email=email, is_new_user=True)

        user_signup.send_robust(sender=self, user=user, source="api", referrer=data.get("referrer"))

        # can_register should only allow a single registration
        request.session.pop("can_register", None)

        return user


class AuthRegisterEndpoint(Endpoint):
    # Disable permission requirements.
    permission_classes = []

    def can_register(self, request):
        return bool(auth.has_user_registration() or request.session.get("can_register"))

    def post(self, request):
        if not self.can_register(request):
            return self.respond({"details": "Registration is not allowed"}, status=400)

        if request.user.is_authenticated():
            # Authentication not allowed when a user is currently signed in
            # 409 Conflict
            metrics.incr("auth-register.failure", tags={"response_code": 409}, skip_internal=False)
            return self.respond({"details": "Cannot register while authenticated"}, status=409)

        serializer = AuthRegisterSerializer(data=request.data, context={"request": request})

        if not serializer.is_valid():
            # collect more specific error message
            for field in serializer.errors:
                metrics.incr(
                    "auth-register.failure",
                    tags={"response_code": 400, "type": "serializer-error", "subtype": field},
                    skip_internal=False,
                )

            return self.respond(serializer.errors, status=400)

        try:
            with transaction.atomic():
                user = serializer.save()
        except Exception as e:
            logger.error(repr(e), extra={"request": request}, exc_info=True)
            metrics.incr(
                "auth-register.failure",
                tags={"response_code": 400, "type": "unknown-billing-error"},
                skip_internal=False,
            )
            return self.respond({"details": ERR_UNKNOWN}, status=400)

        return self.respond(serialize(user))
