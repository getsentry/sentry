"""
sentry.wsgi
~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os
import os.path
import sys

# Add the project to the python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), os.pardir))

# Configure the application only if it seemingly isnt already configured
from django.conf import settings
if not settings.configured:
    from sentry.runner import configure
    configure()

if settings.SESSION_FILE_PATH and not os.path.exists(settings.SESSION_FILE_PATH):
    try:
        os.makedirs(settings.SESSION_FILE_PATH)
    except OSError:
        pass

from django.core.handlers.wsgi import WSGIHandler


class FileWrapperWSGIHandler(WSGIHandler):
    """A WSGIHandler implementation that handles a StreamingHttpResponse
    from django to leverage wsgi.file_wrapper for delivering large streaming
    responses.

    Note: this was added natively into Django 1.8, so if by some reason,
    we upgraded, this wouldn't be relevant anymore."""
    def __call__(self, environ, start_response):
        response = super(FileWrapperWSGIHandler, self).__call__(environ, start_response)
        if hasattr(response, 'streaming') and response.streaming:
            try:
                response = environ['wsgi.file_wrapper'](response.streaming_content)
            except KeyError:
                # In our case, we're shipping with uwsgi, so it's safer to assume
                # that wsgi.file_wrapper does exist. It'd be exceptional otherwise.
                pass
        return response

# Run WSGI handler for the application
from raven.contrib.django.middleware.wsgi import Sentry
application = Sentry(FileWrapperWSGIHandler())
