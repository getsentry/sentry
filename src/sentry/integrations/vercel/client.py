from __future__ import annotations

import logging
from typing import NotRequired, TypedDict

from sentry.integrations.client import ApiClient
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.vercel.api")


class _ParamsDict(TypedDict):
    limit: int
    until: NotRequired[str | None]


class VercelClient(ApiClient):
    base_url = "https://api.vercel.com"
    integration_name = "vercel"
    pagination_limit = 100

    # Current User API (Read)
    # https://vercel.com/docs/integrations/reference#using-the-vercel-api/scopes/user
    GET_USER_URL = "/v2/user"

    # Teams API Scope (Read)
    # https://vercel.com/docs/rest-api#endpoints/teams/get-a-team
    GET_TEAM_URL = "/v2/teams/%s"

    # Projects API Scope (Read)
    # https://vercel.com/docs/rest-api#endpoints/projects/find-a-project-by-id-or-name
    GET_PROJECT_URL = "/v9/projects/%s"
    # https://vercel.com/docs/rest-api#endpoints/projects/retrieve-a-list-of-projects
    GET_PROJECTS_URL = "/v9/projects/"

    # Project Environment Variables API Scope (Read/Write)
    # https://vercel.com/docs/rest-api#endpoints/projects/create-one-or-more-environment-variables
    CREATE_ENV_VAR_URL = "/v9/projects/%s/env"

    # Integration Configuration API Scope (Read/Write)
    # https://vercel.com/docs/rest-api#endpoints/integrations/delete-an-integration-configuration
    UNINSTALL = "/v1/integrations/configuration/%s"

    def __init__(self, access_token, team_id=None):
        super().__init__()
        self.access_token = access_token
        self.team_id = team_id

    def request(self, method, path, data=None, params=None, allow_text=False):
        if self.team_id:
            # always need to use the team_id as a param for requests
            params = params or {}
            params["teamId"] = self.team_id
        headers = {"Authorization": f"Bearer {self.access_token}"}
        try:
            return self._request(
                method, path, headers=headers, data=data, params=params, allow_text=allow_text
            )
        except ApiError as e:
            if not e.code == 402:
                raise

    def get_team(self):
        assert self.team_id
        return self.get(self.GET_TEAM_URL % self.team_id)

    def get_user(self):
        return self.get(self.GET_USER_URL)["user"]

    def get_from_pagination(self, url, data_key):
        # Vercel Pagination Guide: https://vercel.com/docs/rest-api#introduction/api-basics/pagination
        params: _ParamsDict = {"limit": self.pagination_limit}
        results = []
        next_timestamp: str | None = ""
        while next_timestamp is not None:
            response = self.get(url, params=params)
            results += response[data_key]
            next_timestamp = response["pagination"]["next"]
            params["until"] = next_timestamp
        return results

    def get_projects(self):
        return self.get_from_pagination(self.GET_PROJECTS_URL, "projects")

    def get_project(self, vercel_project_id):
        return self.get(self.GET_PROJECT_URL % vercel_project_id)

    def create_env_variable(self, vercel_project_id, data, upsert=False):
        # `upsert=true` makes Vercel update the value in place when the env var
        # already exists rather than returning ENV_ALREADY_EXISTS. This avoids a
        # read-back-and-patch dance that cannot find env vars Vercel hides from
        # the listing endpoint (e.g. hidden production vars).
        params = {"upsert": "true"} if upsert else None
        return self.post(self.CREATE_ENV_VAR_URL % vercel_project_id, data=data, params=params)

    def uninstall(self, configuration_id):
        return self.delete(self.UNINSTALL % configuration_id)
