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
sys.stdout = sys.stderr

# Configure the application (Logan)
from sentry.utils.runner import configure
configure()

from django.conf import settings
if settings.SESSION_FILE_PATH and not os.path.exists(settings.SESSION_FILE_PATH):
    try:
        os.makedirs(settings.SESSION_FILE_PATH)
    except OSError:
        pass

# Run WSGI handler for the application
from django.core.wsgi import get_wsgi_application
from raven.contrib.django.middleware.wsgi import Sentry
application = Sentry(get_wsgi_application())
