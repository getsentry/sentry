from sentry.integrations.github.client import GitHubClientMixin
from sentry.integrations.github.utils import get_jwt
from sentry.utils import jwt


class GitHubEnterpriseAppsClient(GitHubClientMixin):
    base_url = None
    integration_name = "github_enterprise"

    def __init__(self, base_url, integration, app_id, private_key, verify_ssl):
        self.base_url = f"https://{base_url}/api/v3"
        self.integration = integration
        self.app_id = app_id
        self.private_key = private_key
        super().__init__(verify_ssl=verify_ssl)

    def get_jwt(self):
        return get_jwt(github_id=self.app_id, github_private_key=self.private_key)

    def create_token(self):
        headers = {
            # TODO(jess): remove this whenever it's out of preview
            "Accept": "application/vnd.github.machine-man-preview+json",
        }
        headers.update(jwt.authorization_header(self.get_jwt()))
        return self.post(
            "/app/installations/{}/access_tokens".format(
                self.integration.metadata["installation_id"]
            ),
            headers=headers,
        )
