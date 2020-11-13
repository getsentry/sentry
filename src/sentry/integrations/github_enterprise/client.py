from __future__ import absolute_import


from sentry.integrations.github.utils import get_jwt
from sentry.integrations.github.client import GitHubClientMixin


class GitHubEnterpriseAppsClient(GitHubClientMixin):
    base_url = None
    integration_name = "github_enterprise"

    def __init__(self, base_url, integration, app_id, private_key, verify_ssl):
        self.base_url = u"https://{}/api/v3".format(base_url)
        self.integration = integration
        self.app_id = app_id
        self.private_key = private_key
        super(GitHubEnterpriseAppsClient, self).__init__(verify_ssl=verify_ssl)

    def get_jwt(self):
        return get_jwt(github_id=self.app_id, github_private_key=self.private_key)

    def create_token(self):
        return self.post(
            u"/app/installations/{}/access_tokens".format(
                self.integration.metadata["installation_id"]
            ),
            headers={
                "Authorization": b"Bearer %s" % self.get_jwt(),
                # TODO(jess): remove this whenever it's out of preview
                "Accept": "application/vnd.github.machine-man-preview+json",
            },
        )
