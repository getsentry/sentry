import logging

class DBLogHandler(logging.Handler):
    def emit(self, record):
        from djangodblog.models import Error

        Error.objects.create_from_record(record)