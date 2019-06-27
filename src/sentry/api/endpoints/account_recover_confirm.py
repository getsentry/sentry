from __future__ import absolute_import

import logging
from django.db import transaction
from django.contrib.auth import login as login_user, authenticate
from rest_framework.response import Response

from sentry.models import Authenticator, LostPasswordHash
from sentry.api.base import Endpoint
from sentry.security import capture_security_activity
from sentry.utils import auth
from sentry.web.forms.accounts import (
    ChangePasswordRecoverForm
)

from sentry.web.frontend.base import OrganizationMixin
logger = logging.getLogger('sentry.accounts')


class AccountRecoverConfirmEndpoint(Endpoint, OrganizationMixin):
    # Disable authentication and permission requirements.
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        # TODO fix KeyError here.
        mode = request.GET['mode']
        user_id = request.GET['user_id']
        hash = request.GET['hash']
        if mode not in ('recover', 'set_password'):
            return Response({'detail': 'Invalid mode provided.'}, status=400)
        try:
            password_hash = LostPasswordHash.objects.get(user=user_id, hash=hash)
            if not password_hash.is_valid():
                password_hash.delete()
                raise LostPasswordHash.DoesNotExist
        except LostPasswordHash.DoesNotExist:
            return Response({'detail': 'Invalid or expired hash or userid'}, status=400)
        return Response({'hash': hash, 'user_id': user_id})

    def post(self, request):
        # TODO fix KeyError here.
        mode = request.DATA['mode']
        user_id = request.DATA['user_id']
        hash = request.DATA['hash']
        if mode not in ('recover', 'set_password'):
            return Response({'detail': 'Invalid mode provided.'}, status=400)
        try:
            password_hash = LostPasswordHash.objects.get(user=user_id, hash=hash)
            if not password_hash.is_valid():
                password_hash.delete()
                raise LostPasswordHash.DoesNotExist
            user = password_hash.user

        except LostPasswordHash.DoesNotExist:
            return Response({'detail': 'Invalid or expired hash or userid'}, status=400)

        form = ChangePasswordRecoverForm(request.DATA)
        if form.is_valid():
            with transaction.atomic():
                user.set_password(form.cleaned_data['password'])
                user.refresh_session_nonce(request)
                user.save()

                # Ugly way of doing this, but Django requires the backend be set
                user = authenticate(
                    username=user.username,
                    password=form.cleaned_data['password'],
                )

                # Only log the user in if there is no two-factor on the
                # account.
                if not Authenticator.objects.user_has_2fa(user):
                    login_user(request, user)

                password_hash.delete()

                capture_security_activity(
                    account=user,
                    type='password-changed',
                    actor=request.user,
                    ip_address=request.META['REMOTE_ADDR'],
                    send_email=True,
                )

            organization = self.get_active_organization(request)
            org_url = None
            if organization:
                org_url = organization.get_url()
            next_uri = auth.get_login_redirect(request, org_url)
            return Response({'nextUri': next_uri})

        return Response({
            'detail': 'Invalid request',
            'errors': form.errors
        }, status=400)
