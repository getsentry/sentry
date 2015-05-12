"""
sentry.plugins.base.structs
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

__all__ = ['ReleaseHook']

from django.utils import timezone

from sentry.models import Release


class ReleaseHook(object):
    def __init__(self, project):
        self.project = project

    def start_release(self, version, **defaults):
        defaults.setdefault('date_started', timezone.now())
        Release.objects.create_or_update(
            version=version,
            project=self.project,
            defaults=defaults,
        )

    def finish_release(self, version, **defaults):
        defaults.setdefault('date_released', timezone.now())
        Release.objects.create_or_update(
            version=version,
            project=self.project,
            defaults=defaults,
        )

    def handle(self, request):
        raise NotImplementedError
