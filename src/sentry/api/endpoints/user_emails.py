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


InvalidEmailResponse = Response({'detail': 'Invalid email'}, status=status.HTTP_400_BAD_REQUEST)


class InvalidEmailError(Exception):
    pass


class DuplicateEmailError(Exception):
    pass


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)


def get_email(request):
    """
    Returns None if invalid email else returns a normalized email (lowercase + whitespace strip)
    """

    serializer = EmailSerializer(data=request.DATA)

    # Bad email
    if not serializer.is_valid():
        return None

    return serializer.object['email'].lower().strip()


def add_email(email, user):
    """
    Adds an email to user account

    Can be either primary or secondary
    """

    # Bad email
    if email is None:
        raise InvalidEmailError

    # check if this email already exists for user
    if email and UserEmail.objects.filter(
        user=user, email__iexact=email
    ).exists():
        raise DuplicateEmailError

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
        newsletter.update_subscription(user=user,
                                       verified=False,
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

        return Response(serialize(list(emails), user=user))

    @sudo_required
    def post(self, request, user):
        """
        Adds a secondary email address
        ``````````````````````````````

        Adds a secondary email address to account.

        :param string email: email to add
        :auth required:
        """

        email = get_email(request)

        try:
            new_email = add_email(email, user)
        except (InvalidEmailError, DuplicateEmailError):
            return InvalidEmailResponse
        else:
            logger.info(
                'user.email.add',
                extra={
                    'user_id': user.id,
                    'ip_address': request.META['REMOTE_ADDR'],
                    'email': new_email.email,
                }
            )

            return Response(status=status.HTTP_204_NO_CONTENT)

    @sudo_required
    def put(self, request, user):
        """
        Updates primary email
        `````````````````````

        Changes primary email

        :param string email: the email to set as primary email
        :auth required:
        """

        new_email = get_email(request)
        old_email = user.email

        if new_email is None:
            return InvalidEmailResponse

        # If email doesn't exist for user, attempt to add new email
        if not UserEmail.objects.filter(
            user=user, email__iexact=new_email
        ).exists():
            try:
                added_email = add_email(new_email, user)
            except InvalidEmailError:
                return InvalidEmailResponse
            except DuplicateEmailError:
                pass
            else:
                logger.info(
                    'user.email.add',
                    extra={
                        'user_id': user.id,
                        'ip_address': request.META['REMOTE_ADDR'],
                        'email': added_email.email,
                    }
                )
                new_email = added_email.email

        # Check if email is in use
        # Is this a security/abuse concern?
        if User.objects.filter(Q(email__iexact=new_email) | Q(username__iexact=new_email)
                               ).exclude(id=user.id).exists():
            return InvalidEmailResponse

        if new_email == old_email:
            return InvalidEmailResponse

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

        return Response(status=status.HTTP_204_NO_CONTENT)

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
            return Response({'detail': 'Cannot remove primary email'},
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

        return Response(status=status.HTTP_204_NO_CONTENT)
