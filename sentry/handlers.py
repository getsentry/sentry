import logging

class DBLogHandler(logging.Handler):
    def emit(self, record):
        from sentry.models import Message

        Message.objects.create_from_record(record)