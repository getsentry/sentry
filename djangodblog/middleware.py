from django.conf import settings as dj_settings
from django.db import transaction
from django.http import Http404

from djangodblog.models import Error
from djangodblog import settings

import logging
import sys

__all__ = ('DBLogMiddleware',)

class DBLogMiddleware(object):
    @transaction.commit_on_success
    def process_exception(self, request, exception):
        if not settings.CATCH_404_ERRORS \
                and isinstance(exception, Http404):                
            return

        if dj_settings.DEBUG or getattr(exception, 'skip_dblog', False):
            return

        if transaction.is_dirty():
            transaction.rollback()

        extra = dict(
            url=request.build_absolute_uri(), data=dict(
                META=request.META,
                POST=request.POST,
                GET=request.GET,
                COOKIES=request.COOKIES,
            )
        )

        if settings.USE_LOGGING:
            logging.getLogger('dblog').critical(exception, exc_info=sys.exc_info(), extra=extra)
        else:
            Error.objects.create_from_exception(**extra)        
