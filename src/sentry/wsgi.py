import io
import os.path
import sys

from django.urls import reverse

# Add the project to the python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), os.pardir))

# Configure the application only if it seemingly isn't already configured
from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure()

from django.core.handlers.wsgi import WSGIHandler

# Run WSGI handler for the application
application = WSGIHandler()


warmup_host_name = settings.ALLOWED_HOSTS[0] if settings.ALLOWED_HOSTS[0] != "*" else "127.0.0.1"

# trigger a warmup of the application
application(
    {
        "PATH_INFO": reverse("sentry-warmup"),
        "REQUEST_METHOD": "GET",
        "SERVER_NAME": warmup_host_name,
        "SERVER_PORT": "9001",
        "wsgi.input": io.BytesIO(),
        "wsgi.url_scheme": "https",
    },
    lambda status, response_headers, exc_info=None: lambda bts: None,
)
