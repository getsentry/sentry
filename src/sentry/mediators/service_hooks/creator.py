from __future__ import absolute_import

import six

from collections import Iterable

from sentry.mediators import Mediator, Param
from sentry.models import ServiceHook


class Creator(Mediator):
    application = Param('sentry.models.ApiApplication', required=False)
    actor = Param('sentry.db.models.BaseModel')
    project = Param('sentry.models.Project')
    events = Param(Iterable)
    url = Param(six.string_types)

    def call(self):
        self.hook = self._create_service_hook()
        return self.hook

    def _create_service_hook(self):
        return ServiceHook.objects.create(
            application=self.application,
            actor_id=self.actor.id,
            project_id=self.project.id,
            events=self.events,
            url=self.url,
        )
