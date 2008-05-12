from models import Error, ErrorBatch

import traceback
import socket
import warnings
import md5

class DBLogMiddleware(object):
    def process_exception(self, request, exception):
        server_name = socket.gethostname()
        tb_text     = traceback.format_exc()
        class_name  = exception.__class__.__name__
        checksum    = md5.new(tb_text).hexdigest()

        defaults = dict(
            class_name  = class_name,
            message     = exception.message,
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
                batch.save()
        except Exception, exc:
            warnings.warn(unicode(exc))