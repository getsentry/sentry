from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.models.servicehook import ServiceHookProject
from sentry.sentry_apps.services.region.model import RpcPlatformExternalIssue, RpcServiceHookProject


def serialize_service_hook_project(project: ServiceHookProject) -> RpcServiceHookProject:
    return RpcServiceHookProject(
        id=project.id,
        project_id=project.project_id,
    )


def serialize_platform_external_issue(issue: PlatformExternalIssue) -> RpcPlatformExternalIssue:
    return RpcPlatformExternalIssue(
        id=issue.id,
        group_id=issue.group_id,
        service_type=issue.service_type,
        display_name=issue.display_name,
        web_url=issue.web_url,
    )
