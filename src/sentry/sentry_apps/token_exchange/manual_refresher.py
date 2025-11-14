from typing import int
import logging
from dataclasses import dataclass

from django.db import router, transaction
from django.utils.functional import cached_property

from sentry import analytics
from sentry.analytics.events.sentry_app_token_exchanged import SentryAppTokenExchangedEvent
from sentry.hybridcloud.models.outbox import OutboxDatabaseError, OutboxFlushError
from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.metrics import (
    SentryAppEventType,
    SentryAppInteractionEvent,
    SentryAppInteractionType,
)
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.token_exchange.util import SENSITIVE_CHARACTER_LIMIT, token_expiration
from sentry.sentry_apps.token_exchange.validator import Validator
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.users.models.user import User

logger = logging.getLogger("sentry.token-exchange")


@dataclass
class ManualTokenRefresher:
    """
    Refreshes an installation's token after validation (i.e client_secret_jwt or client_credentials)
    Currently meant for 3rd party integrations to manually refresh their tokens.
    """

    install: SentryAppInstallation
    client_id: str
    user: User

    def run(self) -> ApiToken:
        with SentryAppInteractionEvent(
            operation_type=SentryAppInteractionType.AUTHORIZATIONS,
            event_type=SentryAppEventType.MANUAL_REFRESHER,
        ).capture() as lifecycle:
            context = {
                "installation_uuid": self.install.uuid,
                "client_id": self.application.client_id[:SENSITIVE_CHARACTER_LIMIT],
                "sentry_app_id": self.install.sentry_app.id,
            }
            lifecycle.add_extras(context)

            try:
                token = None
                with transaction.atomic(router.db_for_write(ApiToken)):
                    self._validate()
                    self._delete_existing_token()

                    token = self._create_new_token()
                    self._record_token_exchange()
                    return token
            except (OutboxDatabaseError, OutboxFlushError) as e:
                if token is not None:
                    logger.warning(
                        "manual_refresher.outbox-failure",
                        extra=context,
                        exc_info=e,
                    )
                    self._record_token_exchange()
                    return token

                raise SentryAppSentryError(
                    message="Failed to refresh given token",
                    status_code=500,
                    webhook_context=context,
                ) from e
            except SentryAppIntegratorError as e:
                lifecycle.record_halt(halt_reason=e)
                raise

    def _delete_existing_token(self) -> None:
        # An installation must have a token to be refreshed
        # Lack of token indicates the api grant hasn't been exchanged yet
        if self.installation.api_token is None:
            raise SentryAppIntegratorError(
                message="Installation does not have a token",
                status_code=401,
                webhook_context={"installation_uuid": self.install.uuid},
            )
        self.installation.api_token.delete()

    def _record_token_exchange(self) -> None:
        analytics.record(
            SentryAppTokenExchangedEvent(
                sentry_app_installation_id=self.install.id,
                exchange_type="manual_refresh",
            )
        )
        logger.info(
            "manual_refresher.token_exchange",
            extra={
                "installation_uuid": self.install.uuid,
                "sentry_app_id": self.install.sentry_app.id,
            },
        )

    def _validate(self) -> None:
        Validator(install=self.installation, client_id=self.client_id, user=self.user).run()

    def _create_new_token(self) -> ApiToken:
        token = ApiToken.objects.create(
            user=self.user,
            application=self.application,
            scope_list=self.sentry_app.scope_list,
            expires_at=token_expiration(),
        )
        try:
            SentryAppInstallation.objects.get(id=self.install.id).update(api_token=token)
        except SentryAppInstallation.DoesNotExist:
            pass
        return token

    @cached_property
    def installation(self) -> SentryAppInstallation:
        try:
            return SentryAppInstallation.objects.get(id=self.install.id)
        except SentryAppInstallation.DoesNotExist:
            raise SentryAppIntegratorError(
                message="Installation not found",
                status_code=404,
                webhook_context={"installation_uuid": self.install.uuid},
            )

    @cached_property
    def application(self) -> ApiApplication:
        try:
            return ApiApplication.objects.get(client_id=self.client_id)
        except ApiApplication.DoesNotExist:
            raise SentryAppSentryError(
                message="Could not find matching Application for given client_id",
                status_code=401,
                webhook_context={
                    "client_id": self.client_id,
                    "installation_uuid": self.install.uuid,
                },
            )

    @property
    def sentry_app(self) -> SentryApp:
        try:
            return self.application.sentry_app
        except SentryApp.DoesNotExist:
            raise SentryAppSentryError(
                message="Sentry App does not exist on attached Application",
                status_code=401,
                webhook_context={
                    "application_id": self.application.id,
                    "installation_uuid": self.install.uuid,
                    "client_id": self.application.client_id[:SENSITIVE_CHARACTER_LIMIT],
                },
            )
