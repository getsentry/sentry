# Configure the application and django if it hasn't been done already.
from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure()
