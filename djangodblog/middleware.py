from django.conf import settings
from django.http import Http404

from models import Error

__all__ = ('DBLogMiddleware',)

class DBLogMiddleware(object):
    def process_exception(self, request, exception):
        if not getattr(settings, 'DBLOG_CATCH_404_ERRORS', False) and isinstance(exception, Http404):
            return

        Error.objects.create_from_exception(exception, url=request.build_absolute_uri())