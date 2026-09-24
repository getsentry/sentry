import io
import os.path
import sys
from urllib.parse import urlsplit

from django.urls import reverse

# Add the project to the python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), os.pardir))

# Configure the application only if it seemingly isn't already configured
from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure()

from django.core.handlers.wsgi import WSGIHandler

from sentry import options

# Run WSGI handler for the application
application = WSGIHandler()

environ = {
    "PATH_INFO": reverse("sentry-warmup"),
    "REQUEST_METHOD": "GET",
    "SERVER_NAME": "127.0.0.1",
    "SERVER_PORT": "9001",
    "wsgi.input": io.BytesIO(),
    "wsgi.url_scheme": "https",
}

if options.get("warmup.enabled"):
    try:
        host = urlsplit(options.get("system.url-prefix")).netloc
    except Exception:
        host = None
    if host:
        environ["HTTP_HOST"] = host

# Trigger a warmup of the application
application(
    environ,
    lambda status, response_headers, exc_info=None: lambda bts: None,
)
