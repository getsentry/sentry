from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.sentry_apps.services.hook import RpcServiceHook


def serialize_service_hook(hook: ServiceHook) -> RpcServiceHook:
    return RpcServiceHook(
        id=hook.id,
        guid=hook.guid,
        application_id=hook.application_id,
        installation_id=hook.installation_id,
        project_id=hook.project_id,
        organization_id=hook.organization_id,
        url=hook.url,
        events=hook.events,
        status=hook.status,
    )
