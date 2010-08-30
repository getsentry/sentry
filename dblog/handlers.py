import logging

class DBLogHandler(logging.Handler):
    def emit(self, record):
        from dblog.models import Message

        Message.objects.create_from_record(record)