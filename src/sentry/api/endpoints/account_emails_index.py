from __future__ import absolute_import

import logging

from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework.response import Response
from rest_framework import serializers

from sentry import newsletter
from sentry.api.base import Endpoint
from sentry.api.bases.user import UserPermission
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import User, UserEmail, UserOption

logger = logging.getLogger('sentry.accounts')


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


class AccountEmailsIndexEndpoint(Endpoint):
    permission_classes = (UserPermission, )

    def get(self, request):
        """
        Get list of emails
        ``````````````````

        Returns primary email and a list of secondary emails

        :auth required:
        """

        user = request.user
        emails = user.emails.all()

        return Response(serialize(list(emails), user=user))

    @sudo_required
    def post(self, request):
        """
        Adds a secondary email address
        ``````````````````````````````

        Adds a secondary email address to account.

        :param string email: email to add
        :auth required:
        """

        email = get_email(request)

        # Bad email
        if email is None:
            return Response("Invalid email", status=400)

        user = request.user

        # check if this email already exists for user
        if email and UserEmail.objects.filter(
            user=user, email__iexact=email
        ).exists():
            return Response("Invalid email", status=400)

        try:
            # Uhh is this needed? just c&p'd from frontend/accounts.py
            with transaction.atomic():
                new_email = UserEmail.objects.create(user=user, email=email)
        except IntegrityError:
            pass
        else:
            new_email.set_hash()
            new_email.save()
            user.send_confirm_email_singular(new_email)

            # Update newsletter subscription and mark as unverified
            newsletter.update_subscription(user,
                                           verified=False,
                                           )

            logger.info(
                'user.email.add',
                extra={
                    'user_id': user.id,
                    'ip_address': request.META['REMOTE_ADDR'],
                    'email': new_email.email,
                }
            )

            return Response(status=204)

        # Otherwise, invalid request
        return Response(status=400)

    @sudo_required
    def put(self, request):
        """
        Updates primary email
        `````````````````````

        Changes primary email

        :param string email: the email to set as primary email
        :auth required:
        """

        new_email = get_email(request)

        # Bad email
        if new_email is None:
            return Response("Invalid email", status=400)

        user = request.user
        old_email = user.email

        # Is this a security/abuse concern?
        # Check if email is in use
        if User.objects.filter(Q(email__iexact=new_email) | Q(username__iexact=new_email)
                               ).exclude(id=user.id).exists():
            return Response("Invalid email", status=400)

        if new_email == old_email:
            return Response("Invalid email", status=400)

        # update notification settings for those set to primary email with new primary email
        alert_email = UserOption.objects.get_value(user=user, key='alert_email')
        if alert_email == old_email:
            UserOption.objects.set_value(user=user, key='alert_email', value=new_email)

        options = UserOption.objects.filter(user=user, key='mail:email')
        for option in options:
            if option.value != old_email:
                continue
            option.value = new_email
            option.save()

        has_new_username = old_email == user.username

        user.email = new_email

        if has_new_username and not User.objects.filter(username__iexact=new_email).exists():
            user.username = old_email

        user.save()

        return Response(status=204)

    @sudo_required
    def delete(self, request):
        """
        Removes an email from account
        `````````````````````````````

        Removes an email from account, can not remove primary email

        :param string email: email to remove
        :auth required:
        """

        user = request.user
        email = request.DATA.get('email')
        primary_email = UserEmail.get_primary_email(user)
        del_email = UserEmail.objects.filter(user=user, email=email)[0]

        # Don't allow deleting primary email?
        if primary_email == del_email:
            return Response("Cannot remove primary email", status=400)

        del_email.delete()

        logger.info(
            'user.email.remove',
            extra={
                'user_id': user.id,
                'ip_address': request.META['REMOTE_ADDR'],
                'email': email,
            }
        )

        return Response(status=204)
