import os.path
import sys

# Add the project to the python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), os.pardir))

# Configure the application only if it seemingly isn't already configured
from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure()

if settings.SESSION_FILE_PATH and not os.path.exists(settings.SESSION_FILE_PATH):
    os.makedirs(settings.SESSION_FILE_PATH, exist_ok=True)

from django.core.handlers.wsgi import WSGIHandler

# Run WSGI handler for the application
application = WSGIHandler()
