from typing import Optional

from sentry.constants import SentryAppStatus
from sentry.models import ApiApplication, SentryApp, SentryAppInstallation
from sentry.services.hybrid_cloud.app import (
    RpcApiApplication,
    RpcSentryApp,
    RpcSentryAppInstallation,
)


def serialize_api_application(api_app: ApiApplication) -> RpcApiApplication:
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
        is_published=app.status == SentryAppStatus.PUBLISHED,
        is_unpublished=app.status == SentryAppStatus.UNPUBLISHED,
        is_internal=app.status == SentryAppStatus.INTERNAL,
        is_publish_request_inprogress=app.status == SentryAppStatus.PUBLISH_REQUEST_INPROGRESS,
        status=app.status,
    )


def serialize_sentry_app_installation(
    installation: SentryAppInstallation, app: Optional[SentryApp] = None
) -> RpcSentryAppInstallation:
    if app is None:
        app = installation.sentry_app

    return RpcSentryAppInstallation(
        id=installation.id,
        organization_id=installation.organization_id,
        status=installation.status,
        sentry_app=serialize_sentry_app(app),
        date_deleted=installation.date_deleted,
        uuid=installation.uuid,
    )
