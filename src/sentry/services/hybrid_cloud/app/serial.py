from typing import Optional

from sentry.constants import SentryAppStatus
from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.models.integrations import SentryAppComponent
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.services.hybrid_cloud.app import (
    RpcApiApplication,
    RpcSentryApp,
    RpcSentryAppComponent,
    RpcSentryAppInstallation,
)


def serialize_api_application(api_app: Optional[ApiApplication]) -> Optional[RpcApiApplication]:
    if not api_app:
        return None
    return RpcApiApplication(
        id=api_app.id,
        client_id=api_app.client_id,
        client_secret=api_app.client_secret,
    )


def serialize_sentry_app(app: SentryApp) -> RpcSentryApp:
    return RpcSentryApp(
        id=app.id,
        scope_list=app.scope_list,
        application_id=app.application_id,
        application=serialize_api_application(app.application),
        proxy_user_id=app.proxy_user_id,
        owner_id=app.owner_id,
        name=app.name,
        slug=app.slug,
        uuid=app.uuid,
        events=app.events,
        webhook_url=app.webhook_url,
        is_alertable=app.is_alertable,
        is_published=app.status == SentryAppStatus.PUBLISHED,
        is_unpublished=app.status == SentryAppStatus.UNPUBLISHED,
        is_internal=app.status == SentryAppStatus.INTERNAL,
        is_publish_request_inprogress=app.status == SentryAppStatus.PUBLISH_REQUEST_INPROGRESS,
        status=SentryAppStatus.as_str(app.status),
        metadata=app.metadata,
    )


def serialize_sentry_app_installation(
    installation: SentryAppInstallation, app: Optional[SentryApp] = None
) -> RpcSentryAppInstallation:
    if app is None:
        app = installation.sentry_app
        assert app is not None

    api_token = None
    if installation.api_token_id:
        try:
            if token := installation.api_token:
                api_token = token.token
        except ApiToken.DoesNotExist:
            pass

    return RpcSentryAppInstallation(
        id=installation.id,
        organization_id=installation.organization_id,
        status=installation.status,
        sentry_app=serialize_sentry_app(app),
        date_deleted=installation.date_deleted,
        uuid=installation.uuid,
        api_token=api_token,
    )


def serialize_sentry_app_component(component: SentryAppComponent) -> RpcSentryAppComponent:
    return RpcSentryAppComponent(
        uuid=str(component.uuid),
        sentry_app_id=component.sentry_app_id,
        type=component.type,
        app_schema=component.schema,
    )
