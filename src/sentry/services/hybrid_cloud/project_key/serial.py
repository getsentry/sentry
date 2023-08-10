from sentry.models import ProjectKey
from sentry.services.hybrid_cloud.project_key import RpcProjectKey


def serialize_project_key(project_key: ProjectKey) -> RpcProjectKey:
    return RpcProjectKey(
        label=project_key.label,
        dsn_public=project_key.dsn_public,
        dsn_private=project_key.dsn_private,
        project_id=project_key.project_id,
        public_key=project_key.public_key,
        secret_key=project_key.secret_key,
    )
