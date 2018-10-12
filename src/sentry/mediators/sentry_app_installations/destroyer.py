from __future__ import absolute_import

from sentry.mediators import Mediator, Param


class Destroyer(Mediator):
    install = Param('sentry.models.SentryAppInstallation')

    def call(self):
        self._destroy_authorization()
        self._destroy_grant()
        self._destroy_installation()
        return self.install

    def _destroy_authorization(self):
        self.install.authorization.delete()

    def _destroy_grant(self):
        self.install.api_grant.delete()

    def _destroy_installation(self):
        self.install.delete()
