# Configure the application and django if it hasn't been done already.
from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure()

# Import task modules so they are part of the memory
# shared by forks
for module in settings.TASKWORKER_IMPORTS:
    __import__(module)
