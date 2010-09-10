import logging

class SentryHandler(logging.Handler):
    def emit(self, record):
        from sentry.client.models import get_client

        get_client().create_from_record(record)