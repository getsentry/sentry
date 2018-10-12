from __future__ import absolute_import

from sentry.mediators import Mediator, Param


class Destroyer(Mediator):
    sentry_app = Param('sentry.models.sentryapp.SentryApp')

    def call(self):
        self._destroy_api_application()
        self._destroy_proxy_user()
        self._destroy_sentry_app()
        return self.sentry_app

    def _destroy_api_application(self):
        self.sentry_app.application.delete()

    def _destroy_proxy_user(self):
        self.sentry_app.proxy_user.delete()

    def _destroy_sentry_app(self):
        self.sentry_app.delete()
