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


def add_email(email: str, user: User) -> UserEmail:
    """
    Adds an email to user account

    Can be either primary or secondary
    """

    # Bad email
    if email is None:
        raise InvalidEmailError

    if UserEmail.objects.filter(user=user, email__iexact=email.lower()).exists():
        raise DuplicateEmailError

    try:
        with transaction.atomic(using=router.db_for_write(UserEmail)):
            new_email = UserEmail.objects.create(user=user, email=email)
    except IntegrityError:
        raise DuplicateEmailError

    new_email.set_hash()
    new_email.save()
    user.send_confirm_email_singular(new_email)
    return new_email


@control_silo_endpoint
class UserEmailsEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
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

        use_signed_urls = options.get("user-settings.signed-url-confirmation-emails")
        try:
            if use_signed_urls:
                add_email_signed(email, user)
                logger.info(
                    "user.email.add",
                    extra={
                        "user_id": user.id,
                        "ip_address": request.META["REMOTE_ADDR"],
                        "used_signed_url": True,
                        "email": email,
                    },
                )
                return self.respond(
                    {"detail": _("A verification email has been sent. Please check your inbox.")},
                    status=201,
                )
            else:
                new_useremail = add_email(email, user)
                logger.info(
                    "user.email.add",
                    extra={
                        "user_id": user.id,
                        "ip_address": request.META["REMOTE_ADDR"],
                        "used_signed_url": False,
                        "email": email,
                    },
                )
                return self.respond(
                    serialize(new_useremail, user=request.user, serializer=UserEmailSerializer()),
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
        Update a primary email address
        """

        validator = EmailValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data
        old_email = user.email.lower()
        new_email = result["email"].lower()

        new_useremail = user.emails.filter(email__iexact=new_email).first()

        # If email doesn't exist for user, attempt to add new email
        if not new_useremail:
            try:
                new_useremail = add_email(new_email, user)
            except DuplicateEmailError:
                new_useremail = user.emails.get(email__iexact=new_email)
            else:
                logger.info(
                    "user.email.add",
                    extra={
                        "user_id": user.id,
                        "ip_address": request.META["REMOTE_ADDR"],
                        "email": new_useremail.email,
                    },
                )
                new_email = new_useremail.email

        # Check if email is in use
        # TODO(dcramer): this needs rate limiting to avoid abuse
        # TODO(dcramer): this needs a lock/constraint
        if (
            User.objects.filter(Q(email__iexact=new_email) | Q(username__iexact=new_email))
            .exclude(id=user.id)
            .exists()
        ):
            return self.respond(
                {"email": _("That email address is already associated with another account.")},
                status=400,
            )

        if not new_useremail.is_verified:
            return self.respond(
                {"email": _("You must verify your email address before marking it as primary.")},
                status=400,
            )

        options = UserOption.objects.filter(user=user, key="mail:email")
        for option in options:
            if option.value != old_email:
                continue
            option.update(value=new_email)

        has_new_username = old_email == user.username

        update_kwargs = {"email": new_email}

        if has_new_username and not User.objects.filter(username__iexact=new_email).exists():
            update_kwargs["username"] = new_email

        # NOTE(mattrobenolt): When changing your primary email address,
        # we explicitly want to invalidate existing lost password hashes,
        # so that in the event of a compromised inbox, an outstanding
        # password hash can't be used to gain access. We also feel this
        # is a large enough of a security concern to force logging
        # out other current sessions.
        user.clear_lost_passwords()
        user.refresh_session_nonce(request._request)
        update_kwargs["session_nonce"] = user.session_nonce

        user.update(**update_kwargs)

        logger.info(
            "user.email.edit",
            extra={
                "user_id": user.id,
                "ip_address": request.META["REMOTE_ADDR"],
                "email": new_email,
            },
        )

        return self.respond(
            serialize(new_useremail, user=request.user, serializer=UserEmailSerializer()),
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
