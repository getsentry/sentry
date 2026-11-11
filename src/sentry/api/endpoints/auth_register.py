from __future__ import annotations

from django.conf import settings
from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import newsletter
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.auth import get_auth_success_payload
from sentry.api.invite_helper import (
    ApiInviteHelper,
    get_invite_details,
    remove_invite_details_from_session,
)
from sentry.api.serializers.models.auth import AuthSuccessSerializer
from sentry.api.validators.auth import (
    EMAIL_ALREADY_REGISTERED,
    RegistrationRequest,
    RegistrationValidator,
)
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.ratelimits.config import RateLimitConfig
from sentry.signals import user_signup
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail
from sentry.utils import auth

INVITE_EMAIL_MISMATCH = _(
    "Use the email address this invitation was sent to, or sign in to an existing account."
)
INVITE_NO_LONGER_VALID = _("This invitation is no longer valid. Ask an admin to send a new one.")


def _create_user(data: RegistrationRequest, email_verified: bool = False) -> User:
    """Create the password-backed user and its database-backed preferences atomically."""
    email = data["email"]
    database = router.db_for_write(User)

    try:
        with transaction.atomic(database):
            user = User(
                username=email,
                email=email,
                email_unique=email,
                name=data["name"],
            )
            user.set_password(data["password"])
            user.save()

            if email_verified:
                # The UserEmail row is created by a post_save signal on User
                UserEmail.objects.filter(user=user, email=user.email).update(is_verified=True)

            if timezone := data.get("timezone"):
                UserOption.objects.create(user=user, key="timezone", value=timezone)
    except IntegrityError:
        if User.objects.filter(
            Q(username__iexact=email) | Q(email__iexact=email) | Q(email_unique__iexact=email)
        ).exists():
            raise serializers.ValidationError({"email": [EMAIL_ALREADY_REGISTERED]})
        raise

    return user


def _apply_newsletter_preference(user: User, data: RegistrationRequest) -> None:
    """Subscribe the new user when newsletter support and consent are both present."""
    if newsletter.backend.is_enabled() and data.get("subscribe"):
        newsletter.backend.create_or_update_subscriptions(
            user, list_ids=newsletter.backend.get_default_list_ids()
        )


def _complete_user_registration(
    request: Request,
    user: User,
    data: RegistrationRequest,
    sender: object,
    send_confirm_email: bool = True,
) -> None:
    """Run account side effects and establish the new user's authenticated session."""
    _apply_newsletter_preference(user, data)
    if send_confirm_email:
        user.send_confirm_emails(is_new_user=True)
    user_signup.send_robust(
        sender=sender,
        user=user,
        source="api",
        referrer="in-app",
    )
    auth.login(request, user)
    _clear_registration_session(request)


def _clear_registration_session(request: Request) -> None:
    request.session.pop("can_register", None)
    request.session.pop("invite_email", None)


def _apply_single_organization_membership(request: Request, user: User) -> RpcOrganization | None:
    """Add the user to the configured single organization when no invite is pending."""
    if ApiInviteHelper.from_session(request=request, logger=auth.logger) is not None:
        return None

    if not settings.SENTRY_SINGLE_ORGANIZATION:
        return None

    organization = organization_service.get_default_organization()
    organization_service.add_organization_member(
        organization_id=organization.id,
        default_org_role=organization.default_role,
        user_id=user.id,
    )
    auth.set_active_org(request, organization.slug)
    return organization


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthRegisterEndpoint(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.FOUNDATIONS
    permission_classes = ()
    csrf_protect = True
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {RateLimitCategory.IP: RateLimit(limit=10, window=60 * 60)},
        }
    )

    @extend_schema(
        operation_id="Register a user account",
        request=RegistrationValidator,
        responses={200: AuthSuccessSerializer},
    )
    def post(self, request: Request) -> Response:
        if request.user.is_authenticated:
            return Response(
                {"detail": "Cannot register while authenticated"},
                status=status.HTTP_409_CONFLICT,
            )

        if not (auth.has_user_registration() or request.session.get("can_register")):
            return Response(
                {"detail": "Registration is not available"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = RegistrationValidator(data=request.data)
        serializer.is_valid(raise_exception=True)

        invite_details = get_invite_details(request)
        if not (invite_details.invite_token and invite_details.invite_member_id):
            # No invite in session: plain open registration, which only self-hosted enables,
            # email verification not required for signup
            user = _create_user(serializer.validated_data)
            _complete_user_registration(request, user, serializer.validated_data, self)
            _apply_single_organization_membership(request, user)
            return Response(get_auth_success_payload(request, user))

        invite_helper = ApiInviteHelper.from_session(request=request, logger=auth.logger)
        if invite_helper is None or not invite_helper.invite_is_valid:
            remove_invite_details_from_session(request)
            _clear_registration_session(request)
            return Response({"detail": INVITE_NO_LONGER_VALID}, status=status.HTTP_403_FORBIDDEN)

        if not invite_helper.is_valid_invite_for_email(serializer.validated_data["email"]):
            raise serializers.ValidationError({"email": [INVITE_EMAIL_MISMATCH]})

        user = _create_user(serializer.validated_data, email_verified=True)
        _complete_user_registration(
            request, user, serializer.validated_data, self, send_confirm_email=False
        )
        return Response(get_auth_success_payload(request, user))
