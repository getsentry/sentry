from django.conf import settings

REDMINE_API_KEY = getattr(settings, 'SENTRY_REDMINE_API_KEY', None)
REDMINE_URL = getattr(settings, 'SENTRY_REDMINE_URL', 'http://localhost:3000')
REDMINE_PROJECT_ID = getattr(settings, 'SENTRY_REDMINE_PROJECT_ID', 1)