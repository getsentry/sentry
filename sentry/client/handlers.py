import logging
import sys

def _safe_dump(record):
    print >> sys.stderr, "Recursive log message sent to SentryHandler"
    try:
        print >> sys.stderr, record.message
    except Exception, e:
        print >> sys.stderr, e


class SentryHandler(logging.Handler):
    def emit(self, record):
        from sentry.client.models import get_client

        # Avoid typical config issues by overriding loggers behavior
        if record.name == 'sentry.errors':
            _safe_dump(record)
            return

        get_client().create_from_record(record)

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
                _safe_dump(record)
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
