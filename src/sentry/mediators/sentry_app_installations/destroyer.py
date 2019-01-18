from __future__ import absolute_import

from sentry.mediators import Mediator, Param
from sentry.mediators import service_hooks
from sentry.models import ServiceHook


class Destroyer(Mediator):
    install = Param('sentry.models.SentryAppInstallation')

    def call(self):
        self._destroy_authorization()
        self._destroy_grant()
        self._destroy_service_hooks()
        self._destroy_installation()
        return self.install

    def _destroy_authorization(self):
        self.install.authorization.delete()

    def _destroy_grant(self):
        self.install.api_grant.delete()

    def _destroy_service_hooks(self):
        hooks = ServiceHook.objects.filter(
            application=self.install.sentry_app.application,
            actor_id=self.install.id,
        )
        for hook in hooks:
            service_hooks.Destroyer.run(
                service_hook=hook,
            )

    def _destroy_installation(self):
        self.install.delete()
