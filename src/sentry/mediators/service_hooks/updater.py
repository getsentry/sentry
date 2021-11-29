from collections.abc import Iterable

from sentry.mediators import Mediator, Param
from sentry.mediators.param import if_param
from sentry.mediators.service_hooks.creator import expand_events


class Updater(Mediator):
    service_hook = Param("sentry.models.ServiceHook")
    application = Param("sentry.models.ApiApplication", required=False)
    actor = Param("sentry.models.User", required=False)
    project = Param("sentry.models.Project", required=False)
    events = Param(Iterable, required=False)
    url = Param((str,), required=False)

    def call(self):
        self._update_application()
        self._update_actor()
        self._update_events()
        self._update_url()
        self.service_hook.save()
        return self.service_hook

    @if_param("application")
    def _update_application(self):
        self.service_hook.application = self.application

    @if_param("actor")
    def _update_actor(self):
        self.service_hook.actor_id = self.actor.id

    @if_param("events")
    def _update_events(self):
        self.service_hook.events = expand_events(self.events)

    @if_param("url")
    def _update_url(self):
        self.service_hook.url = self.url
