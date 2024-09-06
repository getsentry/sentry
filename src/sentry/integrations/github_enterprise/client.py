from sentry.integrations.github.client import GitHubBaseClient
from sentry.integrations.github.utils import get_jwt


class GitHubEnterpriseApiClient(GitHubBaseClient):
    integration_name = "github_enterprise"

    def __init__(self, base_url, integration, app_id, private_key, verify_ssl, org_integration_id):
        self.base_url = f"https://{base_url}"
        self.integration = integration
        self.app_id = app_id
        self.private_key = private_key
        super().__init__(verify_ssl=verify_ssl, org_integration_id=org_integration_id)

    def build_url(self, path: str) -> str:
        if path.startswith("/"):
            if path == "/graphql":
                path = "/api/graphql"
            else:
                path = "/api/v3/{}".format(path.lstrip("/"))
        return super().build_url(path)

    def _get_installation_id(self) -> str:
        return self.integration.metadata["installation_id"]

    def _get_jwt(self):
        return get_jwt(github_id=self.app_id, github_private_key=self.private_key)
