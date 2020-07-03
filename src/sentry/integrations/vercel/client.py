from __future__ import absolute_import

from sentry.integrations.client import ApiClient
from sentry.utils.http import absolute_uri


class VercelClient(ApiClient):

    base_url = "https://api.vercel.com"
    integration_name = "vercel"

    TEAMS_URL = "/v1/teams/%s"
    USER_URL = "/www/user"
    PROJECTS_URL = "/v4/projects/"
    WEBHOOK_URL = "/v1/integrations/webhooks"
    ENV_VAR_URL = "/v4/projects/%s/env"
    GET_ENV_VAR_URL = "/v5/projects/%s/env"
    SECRETS_URL = "/v2/now/secrets"
    GET_SECRET_URL = "/v3/now/secrets/%s"

    def __init__(self, access_token, team_id=None):
        super(VercelClient, self).__init__()
        self.access_token = access_token
        self.team_id = team_id

    def request(self, method, path, data=None, params=None):
        if self.team_id:
            # always need to use the team_id as a param for requests
            params = params or {}
            params["teamId"] = self.team_id
        headers = {"Authorization": u"Bearer {}".format(self.access_token)}
        return self._request(method, path, headers=headers, data=data, params=params)

    def get_team(self):
        assert self.team_id
        return self.get_cached(self.TEAMS_URL % self.team_id)

    def get_user(self):
        return self.get_cached(self.USER_URL)["user"]

    def get_projects(self):
        # TODO: we will need pagination since we are limited to 20
        return self.get(self.PROJECTS_URL)["projects"]

    def create_deploy_webhook(self):
        data = {
            "name": "Sentry webhook",
            "url": absolute_uri("/extensions/vercel/webhook/"),
            "events": ["deployment"],
        }
        response = self.post(self.WEBHOOK_URL, data=data)
        return response

    def get_env_vars(self, vercel_project_id):
        return self.get(self.GET_ENV_VAR_URL % vercel_project_id)

    def get_secret(self, name):
        return self.get(self.GET_SECRET_URL % name.lower())["uid"]

    def create_secret(self, vercel_project_id, name, value):
        data = {"name": name, "value": value}
        response = self.post(self.SECRETS_URL, data=data)["uid"]
        return response

    def create_env_variable(self, vercel_project_id, key, value):
        data = {"key": key, "value": value, "target": "production"}
        response = self.post(self.ENV_VAR_URL % vercel_project_id, data=data)
        return response
