from sentry.api.serializers import AppPlatformEvent, SentryAppInstallationSerializer, serialize
from sentry.coreapi import APIUnauthorized
from sentry.mediators import Mediator, Param
from sentry.utils.cache import memoize
from sentry.utils.sentry_apps import send_and_save_webhook_request


class InstallationNotifier(Mediator):
    install = Param("sentry.models.SentryAppInstallation")
    user = Param("sentry.models.User")
    action = Param((str,))

    def call(self):
        self._verify_action()
        self._send_webhook()

    def _verify_action(self):
        if self.action not in ["created", "deleted"]:
            raise APIUnauthorized(f"Invalid action '{self.action}'")

    def _send_webhook(self):
        return send_and_save_webhook_request(self.sentry_app, self.request)

    @property
    def request(self):
        data = serialize(
            [self.install], user=self.user, serializer=SentryAppInstallationSerializer()
        )[0]

        return AppPlatformEvent(
            resource="installation",
            action=self.action,
            install=self.install,
            data={"installation": data},
            actor=self.user,
        )

    @memoize
    def sentry_app(self):
        return self.install.sentry_app

    @memoize
    def api_grant(self):
        return self.install.api_grant_id and self.install.api_grant
