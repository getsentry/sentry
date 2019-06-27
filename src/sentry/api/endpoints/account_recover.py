from __future__ import absolute_import

import logging
from rest_framework.response import Response

from sentry.app import ratelimiter
from sentry.models import LostPasswordHash
from sentry.api.base import Endpoint
from sentry.web.forms.accounts import (
    RecoverPasswordForm
)
logger = logging.getLogger('sentry.accounts')


class AccountRecoverEndpoint(Endpoint):
    # Disable authentication and permission requirements.
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        extra = {
            'ip_address': request.META['REMOTE_ADDR'],
            'user_agent': request.META.get('HTTP_USER_AGENT'),
        }

        if request.method == 'POST' and ratelimiter.is_limited(
            u'accounts:recover:{}'.format(extra['ip_address']),
            limit=5,
            window=60,  # 5 per minute should be enough for anyone
        ):
            logger.warning('recover.rate-limited', extra=extra)

            payload = {
                'detail': 'You have made too many password recovery attempts. Please try again later.',
            }
            return Response(payload, status=429)

        form = RecoverPasswordForm(request.DATA)
        extra['user_recovered'] = form.data.get('user')

        if form.is_valid():
            email = form.cleaned_data['user']
            if email:
                password_hash = LostPasswordHash.for_user(email)
                password_hash.send_email(request)

                extra['passwordhash_id'] = password_hash.id
                extra['user_id'] = password_hash.user_id

                logger.info('recover.sent', extra=extra)
            return Response({'detail': 'Recovery email sent'})

        if form.errors:
            logger.warning('recover.error', extra=extra)

        return Response({'detail': 'Recovery failed', 'errors': form.errors}, status=400)
