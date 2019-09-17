from __future__ import absolute_import

import six
import sys
import traceback

from rest_framework.response import Response
from sentry.utils.sdk import capture_exception

from .organization import OrganizationEndpoint, OrganizationPermission


class IntegrationEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission,)

    def handle_exception(self, request, exc):
        if hasattr(exc, "code") and exc.code == 503:
            sys.stderr.write(traceback.format_exc())
            event_id = capture_exception()
            context = {"detail": six.text_type(exc), "errorId": event_id}
            response = Response(context, status=503)
            response.exception = True
            return response
        return super(IntegrationEndpoint, self).handle_exception(request, exc)
