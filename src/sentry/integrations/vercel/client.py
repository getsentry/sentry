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
