from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.bases.user import UserPermission


class CloudflareMetadataEndpoint(Endpoint):
    permission_classes = (UserPermission, )

    def get(self, request):
        return Response(
            {
                'metadata': {
                    'username': request.user.username,
                    'userId': six.text_type(request.user.id),
                    'email': request.user.email,
                }
            }
        )
