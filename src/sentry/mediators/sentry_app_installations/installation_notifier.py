from django.db import router
from django.utils.functional import cached_property

from sentry.api.serializers import AppPlatformEvent, SentryAppInstallationSerializer, serialize
from sentry.coreapi import APIUnauthorized
from sentry.mediators.mediator import Mediator
from sentry.mediators.param import Param
from sentry.models.apigrant import ApiGrant
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.users.services.user.model import RpcUser
from sentry.utils.sentry_apps import send_and_save_webhook_request


class InstallationNotifier(Mediator):
    install = Param(SentryAppInstallation)
    user = Param(RpcUser)
    action = Param(str)
    using = router.db_for_write(SentryAppInstallation)

    def call(self) -> None:
        self._verify_action()
        self._send_webhook()

    def _verify_action(self) -> None:
        if self.action not in ["created", "deleted"]:
            raise APIUnauthorized(f"Invalid action '{self.action}'")

    def _send_webhook(self) -> None:
        send_and_save_webhook_request(self.sentry_app, self.request)

    @property
    def request(self) -> AppPlatformEvent:
        data = serialize(
            [self.install],
            user=self.user,
            serializer=SentryAppInstallationSerializer(),
            is_webhook=True,
        )[0]
        return AppPlatformEvent(
            resource="installation",
            action=self.action,
            install=self.install,
            data={"installation": data},
            actor=self.user,
        )

    @cached_property
    def sentry_app(self) -> SentryApp:
        return self.install.sentry_app

    @cached_property
    def api_grant(self) -> ApiGrant | None:
        return self.install.api_grant_id and self.install.api_grant
