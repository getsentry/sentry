"""
sentry.client.models
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import sys
import logging
import warnings

from django.core.signals import got_request_exception

from sentry.conf import settings

warnings.warn('sentry.client will be removed in version 1.14.0. You should switch to raven.client.django', DeprecationWarning)

logger = logging.getLogger('sentry.errors')

if settings.SERVERS:
    class MockTransaction(object):
        def commit_on_success(self, func):
            return func

        def is_dirty(self):
            return False

        def rollback(self):
            pass

    transaction = MockTransaction()
else:
    from django.db import transaction

_client = (None, None)
def get_client():
    global _client
    if _client[0] != settings.CLIENT:
        module, class_name = settings.CLIENT.rsplit('.', 1)
        _client = (settings.CLIENT, getattr(__import__(module, {}, {}, class_name), class_name)())
    return _client[1]
client = get_client()

@transaction.commit_on_success
def sentry_exception_handler(request=None, **kwargs):
    exc_info = sys.exc_info()
    try:

        if settings.DEBUG or getattr(exc_info[0], 'skip_sentry', False):
            return

        if transaction.is_dirty():
            transaction.rollback()

        extra = dict(
            request=request,
        )

        message_id = get_client().create_from_exception(**extra)
    except Exception, exc:
        try:
            logger.exception(u'Unable to process log entry: %s' % (exc,))
        except Exception, exc:
            warnings.warn(u'Unable to process log entry: %s' % (exc,))
    finally:
        del exc_info

got_request_exception.connect(sentry_exception_handler)

