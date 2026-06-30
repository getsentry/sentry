from sentry.models.projectkey import ProjectKey
from sentry.projects.services.project_key import RpcProjectKey


def serialize_project_key(project_key: ProjectKey) -> RpcProjectKey:
    endpoint_urls = project_key.get_endpoint_urls()
    return RpcProjectKey(
        project_id=project_key.project_id,
        dsn_public=endpoint_urls.dsn_public,
        status=project_key.status,
        public_key=project_key.public_key,
        integration_endpoint=endpoint_urls.integration_endpoint,
    )
