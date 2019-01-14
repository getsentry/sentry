from __future__ import absolute_import

from sentry.api.serializers import SentryAppInstallationSerializer, AppPlatformEvent
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
            safe_urlopen(
                url=self.sentry_app.webhook_url,
                data=self.request.body,
                headers=self.request.headers,
                timeout=5,
            )
        )

    @property
    def request(self):
        data = SentryAppInstallationSerializer().serialize(
            self.install,
            attrs={'code': self.api_grant.code},
            user=self.user,
        )

        return AppPlatformEvent(
            resource='installation',
            action='created',
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
