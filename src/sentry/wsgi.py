import io
import os.path
import sys

from django.urls import reverse
from django.utils.translation import activate, get_supported_language_variant

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

# our settings.LANGUAGE_CODE is 'en-us', but during requests it always
# resolves to 'en', as 'en-us' is not a by default supported language.
# activate the supported language variant, so the resolver warms up for
# what serves most requests
activate(get_supported_language_variant(settings.LANGUAGE_CODE))

# trigger a warmup of the application
application(
    {
        "PATH_INFO": reverse("sentry-warmup"),
        "REQUEST_METHOD": "GET",
        "SERVER_NAME": "127.0.0.1",
        "SERVER_PORT": "9001",
        "wsgi.input": io.BytesIO(),
        "wsgi.url_scheme": "https",
    },
    lambda status, response_headers, exc_info=None: lambda bts: None,
)
