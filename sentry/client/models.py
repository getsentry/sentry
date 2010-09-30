import sys
import logging
import warnings

from django.core.signals import got_request_exception
from django.db import  transaction
from django.http import Http404

from sentry import conf
from sentry.client.base import SentryClient

logger = logging.getLogger('sentry.errors')

_client = (None, None)
def get_client():
    global _client
    if _client[0] != conf.CLIENT:
        module, class_name = conf.CLIENT.rsplit('.', 1)
        _client = (conf.CLIENT, getattr(__import__(module, {}, {}, class_name), class_name)())
    return _client[1]
client = get_client()

@transaction.commit_on_success
def sentry_exception_handler(sender, request=None, **kwargs):
    try:
        exc_type, exc_value, exc_traceback = sys.exc_info()

        if not conf.CATCH_404_ERRORS \
                and issubclass(exc_type, Http404):
            return

        if conf.DEBUG or getattr(exc_type, 'skip_sentry', False):
            return

        if transaction.is_dirty():
            transaction.rollback()

        if request:
            data = dict(
                META=request.META,
                POST=request.POST,
                GET=request.GET,
                COOKIES=request.COOKIES,
            )
        else:
            data = dict()

        extra = dict(
            url=request and request.build_absolute_uri() or None,
            data=data,
        )
        
        client = get_client()
        client.create_from_exception(**extra)
    except Exception, exc:
        try:
            logger.exception(u'Unable to process log entry: %s' % (exc,))
        except Exception, exc:
            warnings.warn(u'Unable to process log entry: %s' % (exc,))

got_request_exception.connect(sentry_exception_handler)

