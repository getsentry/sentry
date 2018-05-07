from __future__ import absolute_import

import six
import uuid


def get_header_relay_id(request):
    try:
        return six.text_type(uuid.UUID(request.META['HTTP_X_SENTRY_RELAY_ID']))
    except (LookupError, ValueError, TypeError):
        pass


def get_header_relay_signature(request):
    try:
        return six.text_type(request.META['HTTP_X_SENTRY_RELAY_SIGNATURE'])
    except (LookupError, ValueError, TypeError):
        pass
