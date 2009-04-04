import traceback
import socket
import warnings

from django.conf import settings
from django.http import Http404
from django.utils.hashcompat import md5_constructor

from djangodblog.models import Error, ErrorBatch

__all__ = ('DBLogMiddleware', 'DBLOG_CATCH_404_ERRORS')

DBLOG_CATCH_404_ERRORS = getattr(settings, 'DBLOG_CATCH_404_ERRORS', False)

class DBLogMiddleware(object):
    def process_exception(self, request, exception):
        if not DBLOG_CATCH_404_ERRORS and isinstance(exception, Http404):
            return
        server_name = socket.gethostname()
        tb_text     = traceback.format_exc()
        class_name  = exception.__class__.__name__
        checksum    = md5_constructor(tb_text).hexdigest()

        defaults = dict(
            class_name  = class_name,
            message     = getattr(exception, 'message', ''),
            url         = request.build_absolute_uri(),
            server_name = server_name,
            traceback   = tb_text,
        )

        try:
            Error.objects.create(**defaults)
            batch, created = ErrorBatch.objects.get_or_create(
                class_name = class_name,
                server_name = server_name,
                checksum = checksum,
                defaults = defaults
            )
            if not created:
                batch.times_seen += 1
                batch.resolved = False
                batch.save()
        except Exception, exc:
            warnings.warn(unicode(exc))