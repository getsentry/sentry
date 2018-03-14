from __future__ import absolute_import

import logging

from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import newsletter
from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import User, UserEmail, UserOption

logger = logging.getLogger('sentry.accounts')


class InvalidEmailResponse(Response):
    def __init__(self):
        super(InvalidEmailResponse, self).__init__(
            {'detail': 'Invalid email', 'email': 'Invalid email'},
            status=status.HTTP_400_BAD_REQUEST
        )


class InvalidEmailError(Exception):
    pass


class DuplicateEmailError(Exception):
    pass


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    newsletter = serializers.BooleanField(required=False, default=False)


def add_email(email, user, subscribe_newsletter=False):
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
    else:
        new_email.set_hash()
        new_email.save()
        user.send_confirm_email_singular(new_email)

        # Update newsletter subscription and mark as unverified
        if subscribe_newsletter:
            newsletter.update_subscription(user=user,
                                           verified=False,
                                           list_id=1,
                                           )
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

        serializer = EmailSerializer(data=request.DATA)

        if not serializer.is_valid():
            return InvalidEmailResponse()

        try:
            new_email = add_email(
                serializer.object['email'].lower().strip(),
                user,
                serializer.object['newsletter'])
        except (InvalidEmailError, DuplicateEmailError):
            return InvalidEmailResponse()
        else:
            logger.info(
                'user.email.add',
                extra={
                    'user_id': user.id,
                    'ip_address': request.META['REMOTE_ADDR'],
                    'email': new_email.email,
                }
            )

            return self.respond(serialize(new_email, user=request.user), status=201)

    @sudo_required
    def put(self, request, user):
        """
        Updates primary email
        `````````````````````

        Changes primary email

        :param string email: the email to set as primary email
        :auth required:
        """

        serializer = EmailSerializer(data=request.DATA)

        if not serializer.is_valid():
            return InvalidEmailResponse()

        old_email = user.email

        if not serializer.is_valid():
            return InvalidEmailResponse()

        new_email = serializer.object['email'].lower().strip()
        if new_email == old_email:
            return InvalidEmailResponse()

        # If email doesn't exist for user, attempt to add new email
        new_email_obj = UserEmail.objects.filter(
            user=user, email__iexact=new_email
        ).first()
        if not new_email_obj:
            try:
                new_email_obj = add_email(new_email, user, serializer.object['newsletter'])
            except InvalidEmailError:
                return InvalidEmailResponse()
            except DuplicateEmailError:
                new_email_obj = UserEmail.objects.filter(
                    user=user, email__iexact=new_email
                ).first()
                assert new_email_obj
            else:
                logger.info(
                    'user.email.add',
                    extra={
                        'user_id': user.id,
                        'ip_address': request.META['REMOTE_ADDR'],
                        'email': new_email_obj.email,
                    }
                )
                new_email = new_email_obj.email

        # Check if email is in use
        # Is this a security/abuse concern?
        if User.objects.filter(Q(email__iexact=new_email) | Q(username__iexact=new_email)
                               ).exclude(id=user.id).exists():
            return InvalidEmailResponse()

        if not new_email_obj.is_verified:
            return self.respond(
                {'email': 'You must verify your email address before marking it as primary.'}, status=400)

        # update notification settings for those set to primary email with new primary email
        alert_email = UserOption.objects.get_value(user=user, key='alert_email')
        if alert_email == old_email:
            UserOption.objects.set_value(user=user, key='alert_email', value=new_email)

        options = UserOption.objects.filter(user=user, key='mail:email')
        for option in options:
            if option.value != old_email:
                continue
            option.update(value=new_email)

        has_new_username = old_email == user.username

        update_kwargs = {
            'email': new_email,
        }

        if has_new_username and not User.objects.filter(username__iexact=new_email).exists():
            update_kwargs['username'] = new_email

        user.update(**update_kwargs)

        logger.info(
            'user.email.edit',
            extra={
                'user_id': user.id,
                'ip_address': request.META['REMOTE_ADDR'],
                'email': new_email,
            }
        )

        return self.respond(serialize(new_email_obj, user=request.user))

    @sudo_required
    def delete(self, request, user):
        """
        Removes an email from account
        `````````````````````````````

        Removes an email from account, can not remove primary email

        :param string email: email to remove
        :auth required:
        """

        email = request.DATA.get('email')
        primary_email = UserEmail.get_primary_email(user)
        del_email = UserEmail.objects.filter(user=user, email=email)[0]

        # Don't allow deleting primary email?
        if primary_email == del_email:
            return self.respond({'detail': 'Cannot remove primary email'},
                                status=status.HTTP_400_BAD_REQUEST)

        del_email.delete()

        logger.info(
            'user.email.remove',
            extra={
                'user_id': user.id,
                'ip_address': request.META['REMOTE_ADDR'],
                'email': email,
            }
        )

        return self.respond(status=status.HTTP_204_NO_CONTENT)
