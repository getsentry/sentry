from __future__ import absolute_import

from sentry.integrations.client import ApiClient


class VercelClient(ApiClient):

    base_url = "https://api.vercel.com"
    integration_name = "vercel"

    TEAMS_URL = "/v1/teams/%s"
    USER_URL = "/www/user"

    def __init__(self, access_token):
        # TODO(Steve): we might need a constructor arg to denote if this is a team installation when we do API calls
        super(VercelClient, self).__init__()
        self.access_token = access_token

    def request(self, method, path, data=None, params=None):
        headers = {"Authorization": u"Bearer {}".format(self.access_token)}
        return self._request(method, path, headers=headers, data=data, params=params,)

    def get_team(self, team_id):
        return self.get_cached(self.TEAMS_URL % team_id, params={"teamId": team_id})

    def get_user(self):
        return self.get_cached(self.USER_URL)["user"]
