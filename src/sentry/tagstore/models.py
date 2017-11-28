"""
sentry.tagstore.models
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings

# HACK: This was taken from nodestore.models. Django doesn't play well with our
# naming schemes, and we prefer our methods ways over Django's limited scoping
# from .django.models import *  # NOQA
if settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.legacy.LegacyTagStorage'):
    from sentry.tagstore.legacy.models import *  # NOQA
elif settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.v2'):
    from sentry.tagstore.v2.models import *  # NOQA
