from __future__ import absolute_import

import logging
import six

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint

logger = logging.getLogger("sentry.integrations.cloudflare")


class CloudflareMetadataEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        logger.info("cloudflare.metadata", extra={"user_id": request.user.id})
        return Response(
            {
                "metadata": {
                    "username": request.user.username,
                    "userId": six.text_type(request.user.id),
                    "email": request.user.email,
                }
            }
        )
