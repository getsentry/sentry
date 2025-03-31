from sentry.sentry_apps.models.servicehook import ServiceHook, ServiceHookProject
from sentry.sentry_apps.services.hook import RpcServiceHook
from sentry.sentry_apps.services.hook.model import RpcServiceHookProject


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


def serialize_service_hook_project(hook_project: ServiceHookProject) -> RpcServiceHookProject:
    return RpcServiceHookProject(
        id=hook_project.id,
        service_hook_id=hook_project.service_hook_id,
        project_id=hook_project.project_id,
    )
