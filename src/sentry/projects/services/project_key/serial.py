from sentry.models.projectkey import ProjectKey
from sentry.services.hybrid_cloud.project_key import RpcProjectKey


def serialize_project_key(project_key: ProjectKey) -> RpcProjectKey:
    return RpcProjectKey(
        project_id=project_key.project_id,
        dsn_public=project_key.dsn_public,
        status=project_key.status,
    )
