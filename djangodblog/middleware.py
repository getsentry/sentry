from django.db import transaction
from django.http import Http404

from djangodblog.models import Error
from djangodblog.settings import *

__all__ = ('DBLogMiddleware',)

class DBLogMiddleware(object):
    @transaction.commit_on_success
    def process_exception(self, request, exception):
        if not CATCH_404_ERRORS \
                and isinstance(exception, Http404):                
            return

        if settings.DEBUG or getattr(exception, 'skip_dblog', False):
            return

        if transaction.is_dirty():
            transaction.rollback()

        Error.objects.create_from_exception(url=request.build_absolute_uri(), data=dict(
            META=request.META,
            POST=request.POST,
            GET=request.GET,
            COOKIES=request.COOKIES,
        ))