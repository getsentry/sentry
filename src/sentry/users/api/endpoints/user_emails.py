import logging

from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils.translation import gettext as _
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.api.parsers.email import AllowedEmailField
from sentry.users.api.serializers.useremail import UserEmailSerializer
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail
from sentry.utils.signing import sign

logger = logging.getLogger("sentry.accounts")


class InvalidEmailError(Exception):
    pass


class DuplicateEmailError(Exception):
    pass


class EmailValidator(serializers.Serializer[UserEmail]):
    email = AllowedEmailField(required=True, help_text="The email address to add/remove.")


def add_email_signed(email: str, user: User) -> None:
    """New path for adding email - uses signed URLs"""

    EMAIL_CONFIRMATION_SALT = options.get("user-settings.signed-url-confirmation-emails-salt")

    if email is None:
        raise InvalidEmailError

    if UserEmail.objects.filter(user=user, email__iexact=email.lower()).exists():
        raise DuplicateEmailError

    # Generate signed data for verification URL
    signed_data = sign(
        user_id=user.id,
        email=email,
        salt=EMAIL_CONFIRMATION_SALT,
    )

    # Send verification email with signed URL
    user.send_signed_url_confirm_email_singular(email, signed_data)


@control_silo_endpoint
class UserEmailsEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=10, window=60),
                RateLimitCategory.USER: RateLimit(limit=10, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=60),
            },
        }
    )
    owner = ApiOwner.UNOWNED

    def get(self, request: Request, user: User) -> Response:
        """
        Returns a list of emails. Primary email will have `isPrimary: true`
        """

        emails = user.emails.all()

        return self.respond(
            serialize(list(emails), user=user, serializer=UserEmailSerializer()),
            status=200,
        )

    @sudo_required
    def post(self, request: Request, user: User) -> Response:
        """
        Add a secondary email address to account
        """

        validator = EmailValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data
        email = result["email"].lower().strip()

        try:
            add_email_signed(email, user)
            return self.respond(
                {"detail": _("A verification email has been sent. Please check your inbox.")},
                status=201,
            )
        except DuplicateEmailError:
            return self.respond(
                {"detail": _("That email address is already associated with your account.")},
                status=409,
            )

    @sudo_required
    def put(self, request: Request, user: User) -> Response:
        """
        Update a primary email address.
        The UI only offers "Set as primary" for emails that are already saved and already verified.
        """

        validator = EmailValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data
        old_email = user.email.lower()
        new_email = result["email"].lower()

        # defense in depth: UserEmail must already exist and be verified
        existing_useremail = user.emails.filter(email__iexact=new_email).first()
        if not existing_useremail or not existing_useremail.is_verified:
            return self.respond(
                {
                    "email": _(
                        "You must add and verify an email address before marking it as primary."
                    )
                },
                status=400,
            )

        # Check if new_email is the primary email on another User.
        # User can only see result if they have verified new_email
        if (
            User.objects.filter(Q(email__iexact=new_email) | Q(username__iexact=new_email))
            .exclude(id=user.id)
            .exists()
        ):
            return self.respond(
                {"email": _("That email address is already associated with another account.")},
                status=400,
            )

        # email_unique mirrors email under a DB-level unique constraint.
        # It is normally synced by User.save(), which this update() bypasses.
        update_kwargs = {"email": new_email, "email_unique": new_email}

        # if username is email, update it
        if old_email == user.username:
            update_kwargs["username"] = new_email

        try:
            with transaction.atomic(using=router.db_for_write(User)):
                user_options_using_old_email = UserOption.objects.filter(
                    user=user, key="mail:email", value=old_email
                )
                for user_option in user_options_using_old_email:
                    # do this per-instance .update() to trigger post_save logic
                    user_option.update(value=new_email)

                # NOTE(mattrobenolt): When changing your primary email address,
                # we explicitly want to invalidate existing lost password hashes,
                # so that in the event of a compromised inbox, an outstanding
                # password hash can't be used to gain access. We also feel this
                # is a large enough of a security concern to force logging
                # out other current sessions.
                user.clear_lost_passwords()
                user.refresh_session_nonce()
                update_kwargs["session_nonce"] = user.session_nonce

                user.update(**update_kwargs)
        except IntegrityError:
            # The cross-account check above is racy: email_unique and username are
            # DB-unique, so another account can claim this email between the check
            # and this write.
            return self.respond(
                {"email": _("That email address is already associated with another account.")},
                status=400,
            )

        # only update the session if transaction above succeeds
        request.session["_nonce"] = user.session_nonce

        logger.info(
            "user.email.edit",
            extra={
                "user_id": user.id,
                "ip_address": request.META["REMOTE_ADDR"],
                "email": new_email,
            },
        )

        return self.respond(
            serialize(existing_useremail, user=request.user, serializer=UserEmailSerializer()),
            status=200,
        )

    @sudo_required
    def delete(self, request: Request, user: User) -> Response:
        """
        Removes an email associated with the user account
        """
        validator = EmailValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        email = validator.validated_data["email"]
        primary_email = UserEmail.objects.get_primary_email(user)
        del_email = UserEmail.objects.filter(user=user, email__iexact=email).first()
        del_useroption_email_list = UserOption.objects.filter(
            user=user, key="mail:email", value=email
        )

        # Don't allow deleting primary email?
        if primary_email == del_email:
            return self.respond({"detail": "Cannot remove primary email"}, status=400)

        if del_email:
            del_email.delete()

        for useroption in del_useroption_email_list:
            useroption.delete()

        logger.info(
            "user.email.remove",
            extra={"user_id": user.id, "ip_address": request.META["REMOTE_ADDR"], "email": email},
        )

        return self.respond(status=204)
