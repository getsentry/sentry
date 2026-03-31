import os.path
import sys

# Add the project to the python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), os.pardir))

# Configure the application only if it seemingly isn't already configured
from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure()

from django.core.handlers.asgi import ASGIHandler

# Run ASGI handler for the application
application = ASGIHandler()
