"""
sentry.plugins.base.structs
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

__all__ = ['ReleaseHook']

from django.utils import timezone

from sentry.models import Activity, Release


class ReleaseHook(object):
    def __init__(self, project):
        self.project = project

    def start_release(self, version, **values):
        values.setdefault('date_started', timezone.now())
        Release.objects.create_or_update(
            version=version,
            project=self.project,
            values=values,
        )

    def finish_release(self, version, **values):
        values.setdefault('date_released', timezone.now())
        Release.objects.create_or_update(
            version=version,
            project=self.project,
            values=values,
        )
        Activity.objects.create(
            type=Activity.RELEASE,
            project=self.project,
            ident=version,
            data={'version': version},
            datetime=values['date_released'],
        )
        # TODO(dcramer): enable these when they're optional and useful
        # activity.send_notification()

    def handle(self, request):
        raise NotImplementedError
