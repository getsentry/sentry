from __future__ import absolute_import

from sentry.api.serializers import SentryAppInstallationSerializer, app_platform_event
from sentry.http import safe_urlopen, safe_urlread
from sentry.mediators import Mediator, Param
from sentry.utils.cache import memoize


class InstallationNotifier(Mediator):
    install = Param('sentry.models.SentryAppInstallation')
    user = Param('sentry.models.User')

    def call(self):
        self._send_webhook()

    def _send_webhook(self):
        safe_urlread(
            safe_urlopen(self.sentry_app.webhook_url, json=self.body, timeout=5)
        )

    @property
    def body(self):
        data = SentryAppInstallationSerializer().serialize(
            self.install,
            attrs={'code': self.api_grant.code},
            user=self.user,
        )

        return app_platform_event(
            action='installation',
            install=self.install,
            data=data,
            actor=self.user,
        )

    @memoize
    def sentry_app(self):
        return self.install.sentry_app

    @memoize
    def api_grant(self):
        return self.install.api_grant
