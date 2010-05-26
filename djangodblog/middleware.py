from django.conf import settings
from django.http import Http404

from djangodblog.models import Error
from django.db import transaction

__all__ = ('DBLogMiddleware',)

class DBLogMiddleware(object):
    @transaction.commit_on_success
    def process_exception(self, request, exception):
        if not getattr(settings, 'DBLOG_CATCH_404_ERRORS', False) and isinstance(exception, Http404):
            return

        if getattr(exception, 'skip_dblog', False):
            return

        if transaction.is_dirty():
            transaction.rollback()

        Error.objects.create_from_exception(url=request.build_absolute_uri(), data=dict(
            META=request.META,
            POST=request.POST,
            GET=request.GET,
            COOKIES=request.COOKIES,
        ))