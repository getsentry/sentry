from __future__ import absolute_import

from social_auth.backends.github import GithubBackend, GithubAuth


class GithubAppsBackend(GithubBackend):
    name = "github_apps"


class GithubAppsAuth(GithubAuth):
    AUTH_BACKEND = GithubAppsBackend
    SETTINGS_KEY_NAME = "GITHUB_APPS_APP_ID"
    SETTINGS_SECRET_NAME = "GITHUB_APPS_API_SECRET"
    REDIRECT_STATE = False


BACKENDS = {"github_apps": GithubAppsAuth}
