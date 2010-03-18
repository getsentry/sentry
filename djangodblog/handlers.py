from djangodblog.models import Error

from django.conf import settings

import logging

class DBLogHandler(logging.Handler):
    def emit(self, record):
        Error.objects.create_from_record(record)