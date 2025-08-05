import logging
from dataclasses import dataclass

from django.db import router, transaction
from django.utils.functional import cached_property

from sentry import analytics
from sentry.hybridcloud.models.outbox import OutboxDatabaseError
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
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
class Refresher:
    """
    Exchanges a Refresh Token for a new Access Token
    """

    install: SentryAppInstallation
    refresh_token: str
    client_id: str
    user: User

    def run(self) -> ApiToken:
        with SentryAppInteractionEvent(
            operation_type=SentryAppInteractionType.AUTHORIZATIONS,
            event_type=SentryAppEventType.REFRESHER,
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
                    self.token.delete()

                    self._record_analytics()
                    token = self._create_new_token()
                    return token
            except OutboxDatabaseError as e:
                if token is not None:
                    logger.warning(
                        "refresher.outbox-failure",
                        extra=context,
                        exc_info=e,
                    )
                    return token

                raise SentryAppSentryError(
                    message="Failed to refresh given token",
                    status_code=500,
                    webhook_context=context,
                ) from e
            except SentryAppIntegratorError as e:
                lifecycle.record_halt(halt_reason=e)
                raise

    def _record_analytics(self) -> None:
        analytics.record(
            "sentry_app.token_exchanged",
            sentry_app_installation_id=self.install.id,
            exchange_type="refresh",
        )

    def _validate(self) -> None:
        Validator(install=self.install, client_id=self.client_id, user=self.user).run()

        if self.token.application != self.application:
            assert self.token.application is not None, "Application must exist on ApiToken"
            webhook_context = {
                "client_id_installation_uuid": self.install.uuid,
                "client_id": self.client_id,
            }
            try:
                token_installation = ApiToken.objects.get(
                    refresh_token=self.refresh_token
                ).sentry_app_installation
                webhook_context.update({"token_installation": token_installation.uuid})
            except SentryAppInstallation.DoesNotExist:
                pass

            raise SentryAppIntegratorError(
                message="Token does not belong to the application", webhook_context=webhook_context
            )

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
    def token(self) -> ApiToken:
        try:
            return ApiToken.objects.get(refresh_token=self.refresh_token)
        except ApiToken.DoesNotExist:
            raise SentryAppIntegratorError(
                message="Given refresh token does not exist",
                status_code=401,
                webhook_context={
                    "installation_uuid": self.install.uuid,
                },
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


@dataclass
class IntegratorTokenRefresher:
    client_id: str
    client_secret: str
    user: User
    installation: SentryAppInstallation

    def run(self) -> ApiToken:
        with SentryAppInteractionEvent(
            operation_type=SentryAppInteractionType.AUTHORIZATIONS,
            event_type=SentryAppEventType.REFRESHER,
        ).capture() as lifecycle:
            context = {
                "installation_uuid": self.installation.uuid,
                "client_id": self.client_id,
                "sentry_app_id": self.installation.sentry_app.id,
            }
            lifecycle.add_extras(context)
            try:
                self._validate()
            except SentryAppIntegratorError as e:
                return e

            try:
                application = self._validate_application()
            except SentryAppIntegratorError as e:
                return e
            try:
                with transaction.atomic(router.db_for_write(ApiToken)):
                    old_token = self._get_token(application)
                    old_token.delete()

                    new_token = self._create_new_token()
                    logger.info(
                        "integrator.manual_token_refresh",
                        extra={
                            "installation_id": self.installation.id,
                            "sentry_app_id": self.installation.sentry_app.id,
                        },
                    )
                    return new_token
            except OutboxDatabaseError as e:
                raise SentryAppSentryError(
                    message="Failed to refresh given token",
                    status_code=500,
                    webhook_context={
                        "installation_uuid": self.installation.uuid,
                    },
                ) from e

    def _validate(self) -> None:
        # 1. validate the sentry app is owned by the user
        # 2. validate the sentry app is making the request
        # 3. validate the installation is owned by the sentry app for the given client_id
        Validator(install=self.installation, client_id=self.client_id, user=self.user).run()

    def _validate_application(self) -> ApiApplication:
        # 4. validate the client_id and client_secret pair is valid
        try:
            application = ApiApplication.objects.get(
                client_id=self.client_id,
                client_secret=self.client_secret,
                status=ApiApplicationStatus.active,
            )
        except ApiApplication.DoesNotExist as e:
            raise SentryAppIntegratorError(
                message="Could not find matching Application for given client_id and client_secret",
                status_code=401,
                webhook_context={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret[:SENSITIVE_CHARACTER_LIMIT],
                    "installation_uuid": self.installation.uuid,
                },
            ) from e

        return application

    def _get_token(self, application: ApiApplication) -> ApiToken:
        try:
            return ApiToken.objects.get(application=application)
        except ApiToken.DoesNotExist:
            raise SentryAppSentryError(
                message="Could not find matching token for client_id and client_secret pair",
                status_code=401,
                webhook_context={
                    "installation_uuid": self.installation.uuid,
                },
            )

    def _create_new_token(self, application: ApiApplication) -> ApiToken:
        token = ApiToken.objects.create(
            user=self.user,
            application=application,
            scope_list=self.installation.sentry_app.scope_list,
            expires_at=token_expiration(),
        )
        try:
            SentryAppInstallation.objects.get(id=self.installation.id).update(api_token=token)
        except SentryAppInstallation.DoesNotExist:
            pass
        return token
