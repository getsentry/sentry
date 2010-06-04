from django.conf import settings

CATCH_404_ERRORS = getattr(settings, 'DBLOG_CATCH_404_ERRORS', False)

ENHANCED_TRACEBACKS = getattr(settings, 'DBLOG_ENHANCED_TRACEBACKS', True)

DATABASE_USING = getattr(settings, 'DBLOG_DATABASE_USING', None)

USE_LOGGING = getattr(settings, 'DBLOG_USE_LOGGING', False)