from __future__ import absolute_import

import logging

from rest_framework.response import Response

from sentry.api.base import Endpoint

logger = logging.getLogger('sentry.integrations.cloudflare')


class CloudflareWebhookEndpoint(Endpoint):
    permission_classes = ()

    def post(self, request):
        event = request.DATA.get('event')
        logger.info('cloudflare.webhook.{}'.format(event), extra={
            'user_id': request.user.id if request.user.is_authenticated() else None,
        })
        # TODO(dcramer): We still need to implement various hooks for CF
        return Response({})
