import logging

class SentryHandler(logging.Handler):
    def emit(self, record):
        from sentry.client.base import SentryClient

        SentryClient.create_from_record(record)