from django.conf import settings

CATCH_404_ERRORS = getattr(settings, 'SENTRY_CATCH_404_ERRORS', False)

ENHANCED_TRACEBACKS = getattr(settings, 'SENTRY_ENHANCED_TRACEBACKS', True)

DATABASE_USING = getattr(settings, 'SENTRY_DATABASE_USING', None)

USE_LOGGING = getattr(settings, 'SENTRY_USE_LOGGING', False)

THRASHING_TIMEOUT = getattr(settings, 'SENTRY_THRASHING_TIMEOUT', 60)
THRASHING_LIMIT = getattr(settings, 'SENTRY_THRASHING_LIMIT', 10)
