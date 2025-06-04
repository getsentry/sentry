from django.core.exceptions import PermissionDenied

from sentry import http, options
from sentry.identity.oauth2 import OAuth2Provider


def get_user_info(access_token):
    with http.build_session() as session:
        resp = session.get(
            "https://api.github.com/user",
            headers={
                "Accept": "application/vnd.github.machine-man-preview+json",
                "Authorization": f"token {access_token}",
            },
        )
        resp.raise_for_status()
    return resp.json()


# GitHub has 2 types of apps -- GitHub apps and OAuth apps. SSO is implemented
# using OAuth App, but signup and integrations use the github app. When github
# apps have API parity with OAuth apps, we should move SSO to it as well.
# https://developer.github.com/apps/differences-between-apps/


class GitHubIdentityProvider(OAuth2Provider):
    key = "github"
    name = "GitHub"

    oauth_access_token_url = "https://github.com/login/oauth/access_token"
    oauth_authorize_url = "https://github.com/login/oauth/authorize"

    oauth_scopes = ()

    def get_oauth_client_id(self):
        return options.get("github-app.client-id")

    def get_oauth_client_secret(self):
        return options.get("github-app.client-secret")

    def build_identity(self, data):
        data = data["data"]
        access_token = data.get("access_token")
        if not access_token:
            raise PermissionDenied()
        user = get_user_info(access_token)

        return {
            "type": "github",
            "id": user["id"],
            "email": user["email"],
            "email_verified": bool(user["email"]),
            "login": user["login"],
            "name": user["name"],
            "company": user["company"],
            "scopes": [],  # GitHub apps do not have user scopes
            "data": self.get_oauth_data(data),
        }
