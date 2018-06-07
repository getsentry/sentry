from __future__ import absolute_import


from sentry.integrations.github.utils import get_jwt
from sentry.integrations.github.client import GitHubClientMixin


class GitHubEnterpriseAppsClient(GitHubClientMixin):
    base_url = None

    def __init__(self, base_url, app_id, external_id, private_key):
        self.base_url = "https://{}/api/v3".format(base_url)
        self.external_id = external_id
        self.app_id = app_id
        self.private_key = private_key
        self.token = None
        self.expires_at = None
        # verify_ssl=false is for testing purposes and should be removed before release
        super(GitHubEnterpriseAppsClient, self).__init__(verify_ssl=False)

    def get_jwt(self):
        return get_jwt(github_id=self.app_id, github_private_key=self.private_key)
