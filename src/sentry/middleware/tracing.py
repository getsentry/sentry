from __future__ import absolute_import

import six

from uuid import uuid1

import sentry_sdk


class SentryTracingMiddleware(object):
    def process_request(self, request):
        span_id = six.text_type(uuid1())
        transaction_id = request.META.get('HTTP_X_TRANSACTION_ID') or six.text_type(uuid1())
        with sentry_sdk.configure_scope() as scope:
            scope.set_tag('span_id', span_id)
            scope.set_tag('transaction_id', transaction_id)
