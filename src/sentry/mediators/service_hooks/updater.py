from __future__ import absolute_import

import six

from collections import Iterable

from sentry.mediators import Mediator, Param
from sentry.mediators.param import if_param


class Updater(Mediator):
    service_hook = Param('sentry.models.ServiceHook')
    application = Param('sentry.models.ApiApplication', required=False)
    actor = Param('sentry.models.User', required=False)
    project = Param('sentry.models.Project', required=False)
    events = Param(Iterable, required=False)
    url = Param(six.string_types, required=False)

    def call(self):
        self._update_application()
        self._update_actor()
        self._update_project()
        self._update_events()
        self._update_url()
        return self.service_hook

    @if_param('application')
    def _update_application(self):
        self.service_hook.application = self.application

    @if_param('actor')
    def _update_actor(self):
        self.service_hook.actor_id = self.actor.id

    @if_param('project')
    def _update_project(self):
        self.service_hook.project_id = self.project.id

    @if_param('events')
    def _update_events(self):
        self.service_hook.events = self.events

    @if_param('url')
    def _update_url(self):
        self.service_hook.url = self.url
