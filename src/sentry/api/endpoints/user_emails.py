from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.utils.translation import ugettext as _
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.models import UserEmail


class UserEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    primary = serializers.BooleanField(required=False, default=True)


class UserEmailsEndpoint(UserEndpoint):
    def post(self, request, user):
        serializer = UserEmailSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result = serializer.object

        try:
            with transaction.atomic():
                user_email = UserEmail.objects.create(
                    user=user,
                    email=result.get('email'),
                )

            if result.get('primary'):
                user.update(email=result.get('email'))

        except IntegrityError:
            return Response({'detail': 'Email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        user.send_confirm_email_singular(user_email)
        return Response(
            {'detail': _('A confirmation email has been sent to %s.') % user_email.email}, status=201)
