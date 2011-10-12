"""
sentry.client.celery.conf
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings

CELERY_ROUTING_KEY = getattr(settings, 'SENTRY_CELERY_ROUTING_KEY', 'sentry')