from __future__ import absolute_import

import six
from uuid import uuid1

import sentry_sdk

from sentry import logging


class SentryTracingMiddleware(object):
    def process_request(self, request):
        span_id = six.text_type(uuid1())
        transaction_id = request.META.get('HTTP_X_TRANSACTION_ID') or six.text_type(uuid1())
        request_id = request.META.get('HTTP_X_REQUEST_ID')
        with sentry_sdk.configure_scope() as scope:
            scope.set_tag('span_id', span_id)
            scope.set_tag('transaction_id', transaction_id)
            if request_id is not None:
                scope.set_tag('request_id', request_id)
                logging.bind('sentry', request_id=request_id)
            else:
                # Need to be explicitly unbound when not set
                # otherwise it'll carry onto future requests
                logging.unbind('sentry', 'request_id')
