import logging
import sys

class SentryHandler(logging.Handler):
    def emit(self, record):
        from sentry.client.models import get_client
        from sentry.client.middleware import SentryLogMiddleware

        # Fetch the request from a threadlocal variable, if available
        request = getattr(SentryLogMiddleware.thread, 'request', None)

        # Avoid typical config issues by overriding loggers behavior
        if record.name == 'sentry.errors':
            print >> sys.stderr, "Recursive log message sent to SentryHandler"
            print >> sys.stderr, record.message
            return

        self.format(record)
        get_client().create_from_record(record, request=request)

try:
    import logbook
except ImportError:
    pass
else:
    class SentryLogbookHandler(logbook.Handler):
        def emit(self, record):
            from sentry.client.models import get_client

            # Avoid typical config issues by overriding loggers behavior
            if record.name == 'sentry.errors':
                print >> sys.stderr, "Recursive log message sent to SentryHandler"
                print >> sys.stderr, record.message
                return

            kwargs = dict(
                message=record.message,
                level=record.level,
                logger=record.channel,
                data=record.extra,
            )
            client = get_client()
            if record.exc_info:
                return client.create_from_exception(record.exc_info, **kwargs)
            return client.create_from_text(**kwargs)

