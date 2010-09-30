from django.conf import settings

CELERY_ROUTING_KEY = getattr(settings, 'SENTRY_CELERY_ROUTING_KEY', 'sentry')