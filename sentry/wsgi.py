#!/usr/bin/env python
import os, sys, os.path

# Add the project to the python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.stdout = sys.stderr

# Set our settings module
from django.conf import settings

if not settings.configured:
    os.environ['DJANGO_SETTINGS_MODULE'] = 'sentry.utils.conf.default_settings'
os.environ['CELERY_LOADER'] = 'django'

import django.core.handlers.wsgi

# Run WSGI handler for the application
application = django.core.handlers.wsgi.WSGIHandler()

from django.conf import settings
if settings.SESSION_FILE_PATH:
    try:
        os.makedirs(settings.SESSION_FILE_PATH)
    except OSError:
        pass

