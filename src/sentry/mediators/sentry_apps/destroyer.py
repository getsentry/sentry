from __future__ import absolute_import

from sentry.mediators import Mediator, Param
from sentry.mediators.sentry_app_installations import Destroyer as InstallDestroyer


class Destroyer(Mediator):
    sentry_app = Param('sentry.models.SentryApp')

    def call(self):
        self._destroy_sentry_app_installations()
        self._destroy_api_application()
        self._destroy_proxy_user()
        self._destroy_sentry_app()
        return self.sentry_app

    def _destroy_sentry_app_installations(self):
        for install in self.sentry_app.installations.all():
            InstallDestroyer.run(install=install)

    def _destroy_api_application(self):
        self.sentry_app.application.delete()

    def _destroy_proxy_user(self):
        self.sentry_app.proxy_user.delete()

    def _destroy_sentry_app(self):
        self.sentry_app.delete()
