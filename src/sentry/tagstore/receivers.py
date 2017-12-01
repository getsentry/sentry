"""
sentry.tagstore.receivers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db.models.signals import post_save

from sentry.receivers.releases import ensure_release_exists


def setup_receivers(tagvalue_model, grouptagvalue_model):
    post_save.connect(
        ensure_release_exists, sender=tagvalue_model, dispatch_uid="ensure_release_exists", weak=False
    )
