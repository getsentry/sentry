"""
sentry.tagstore.models
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

# HACK: This was taken from nodestore.models. Django doesn't play well with our
# naming schemes, and we prefer our methods ways over Django's limited scoping
if settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.legacy'):
    from sentry.tagstore.legacy.models import *  # NOQA
elif settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.v2'):
    from sentry.tagstore.v2.models import *  # NOQA
elif settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.multi'):
    for backend in settings.SENTRY_TAGSTORE_OPTIONS.get('backends', []):
        if backend[0].startswith('sentry.tagstore.legacy'):
            from sentry.tagstore.legacy.models import *  # NOQA
        elif backend[0].startswith('sentry.tagstore.v2'):
            from sentry.tagstore.v2.models import TagKey as V2TagKey  # NOQA
            from sentry.tagstore.v2.models import TagValue as V2TagValue  # NOQA
            from sentry.tagstore.v2.models import GroupTagKey as V2GroupTagKey  # NOQA
            from sentry.tagstore.v2.models import GroupTagValue as V2GroupTagValue  # NOQA
            from sentry.tagstore.v2.models import EventTag as V2EventTag  # NOQA
else:
    raise ImproperlyConfigured("Found unknown tagstore backend '%s'" % settings.SENTRY_TAGSTORE)
