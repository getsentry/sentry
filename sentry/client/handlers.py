import logging
import sys

class SentryHandler(logging.Handler):
    def emit(self, record):
        from sentry.client.models import get_client

        # Avoid typical config issues by overriding loggers behavior
        if record.name == 'sentry.errors':
            print >> sys.stderr, record.message
            return

        get_client().create_from_record(record)