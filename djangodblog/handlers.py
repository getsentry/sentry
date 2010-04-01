from djangodblog.models import Error

import logging

class DBLogHandler(logging.Handler):
    def emit(self, record):
        Error.objects.create_from_record(record)