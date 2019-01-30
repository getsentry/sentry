from __future__ import absolute_import

from sentry.mediators import Mediator, Param
from sentry.mediators import sentry_app_installations


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
            sentry_app_installations.Destroyer.run(
                install=install,
                user=self.sentry_app.proxy_user,
            )

    def _destroy_api_application(self):
        self.sentry_app.application.delete()

    def _destroy_proxy_user(self):
        self.sentry_app.proxy_user.delete()

    def _destroy_sentry_app(self):
        self.sentry_app.delete()
