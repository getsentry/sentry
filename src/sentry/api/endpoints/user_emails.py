from __future__ import absolute_import

import logging

from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import serializers

from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.api.validators import AllowedEmailField
from sentry.models import User, UserEmail, UserOption

logger = logging.getLogger("sentry.accounts")


class InvalidEmailError(Exception):
    pass


class DuplicateEmailError(Exception):
    pass


class EmailValidator(serializers.Serializer):
    email = AllowedEmailField(required=True)


def add_email(email, user):
    """
    Adds an email to user account

    Can be either primary or secondary
    """

    # Bad email
    if email is None:
        raise InvalidEmailError

    try:
        with transaction.atomic():
            new_email = UserEmail.objects.create(user=user, email=email)
    except IntegrityError:
        raise DuplicateEmailError

    new_email.set_hash()
    new_email.save()
    user.send_confirm_email_singular(new_email)
    return new_email


class UserEmailsEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        Get list of emails
        ``````````````````

        Returns a list of emails. Primary email will have `isPrimary: true`

        :auth required:
        """

        emails = user.emails.all()

        return self.respond(serialize(list(emails), user=user))

    @sudo_required
    def post(self, request, user):
        """
        Adds a secondary email address
        ``````````````````````````````

        Adds a secondary email address to account.

        :param string email: email to add
        :auth required:
        """

        validator = EmailValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data
        email = result["email"].lower().strip()

        try:
            new_useremail = add_email(email, user)
        except DuplicateEmailError:
            new_useremail = user.emails.get(email__iexact=email)
            return self.respond(serialize(new_useremail, user=request.user), status=200)
        else:
            logger.info(
                "user.email.add",
                extra={
                    "user_id": user.id,
                    "ip_address": request.META["REMOTE_ADDR"],
                    "email": new_useremail.email,
                },
            )
            return self.respond(serialize(new_useremail, user=request.user), status=201)

    @sudo_required
    def put(self, request, user):
        """
        Updates primary email
        `````````````````````

        Changes primary email

        :param string email: the email to set as primary email
        :auth required:
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
                {"email": "That email address is already associated with another account."},
                status=400,
            )

        if not new_useremail.is_verified:
            return self.respond(
                {"email": "You must verify your email address before marking it as primary."},
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

        return self.respond(serialize(new_useremail, user=request.user))

    @sudo_required
    def delete(self, request, user):
        """
        Removes an email from account
        `````````````````````````````

        Removes an email from account, can not remove primary email

        :param string email: email to remove
        :auth required:
        """
        validator = EmailValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        email = validator.validated_data["email"]
        primary_email = UserEmail.get_primary_email(user)
        del_email = UserEmail.objects.filter(user=user, email__iexact=email).first()

        # Don't allow deleting primary email?
        if primary_email == del_email:
            return self.respond({"detail": "Cannot remove primary email"}, status=400)

        del_email.delete()

        logger.info(
            "user.email.remove",
            extra={"user_id": user.id, "ip_address": request.META["REMOTE_ADDR"], "email": email},
        )

        return self.respond(status=204)
