from django.core.exceptions import PermissionDenied

from sentry import http
from sentry.identity.oauth2 import OAuth2Provider


def get_user_info(url, access_token):
    with http.build_session() as session:
        resp = session.get(
            f"https://{url}/api/v3/user",
            headers={
                "Accept": "application/vnd.github.machine-man-preview+json",
                "Authorization": f"token {access_token}",
            },
            verify=False,
        )
        resp.raise_for_status()
    return resp.json()


class GitHubEnterpriseIdentityProvider(OAuth2Provider):
    key = "github_enterprise"
    name = "GitHub Enterprise"

    oauth_scopes = ()

    def build_identity(self, data):
        data = data["data"]
        access_token = data.get("access_token")
        if not access_token:
            raise PermissionDenied()

        # todo(meredith): this doesn't work yet, need to pass in the base url
        user = get_user_info(access_token)

        return {
            "type": "github_enterprise",
            "id": user["id"],
            "email": user["email"],
            "scopes": [],  # GitHub apps do not have user scopes
            "data": self.get_oauth_data(data),
        }
