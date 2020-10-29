from __future__ import absolute_import

import time

from six.moves.urllib.parse import urlencode

from sentry import options
from sentry.integrations.client import ApiClient


# five minutes which is industry standard clock skew tolerence
CLOCK_SKEW = 60 * 5


# MsTeamsAbstractClient abstract client does not handle setting the base url or auth token
class MsTeamsAbstractClient(ApiClient):
    integration_name = "msteams"
    TEAM_URL = "/v3/teams/%s"
    CHANNEL_URL = "/v3/teams/%s/conversations"
    ACTIVITY_URL = "/v3/conversations/%s/activities"
    MESSAGE_URL = "/v3/conversations/%s/activities/%s"
    CONVERSATION_URL = "/v3/conversations"
    MEMBER_URL = "/v3/conversations/%s/pagedmembers"

    def request(self, method, path, data=None, params=None):
        headers = {"Authorization": u"Bearer {}".format(self.access_token)}
        return self._request(method, path, headers=headers, data=data, params=params)

    def get_team_info(self, team_id):
        return self.get(self.TEAM_URL % team_id)

    def get_channel_list(self, team_id):
        resp = self.get(self.CHANNEL_URL % team_id)
        return resp.get("conversations")

    def get_member_list(self, team_id, continuation_token=None):
        url = self.MEMBER_URL % team_id
        params = {"pageSize": 500}
        if continuation_token:
            params["continuationToken"] = continuation_token
        return self.get(url, params=params)

    def get_user_conversation_id(self, user_id, tenant_id):
        data = {"members": [{"id": user_id}], "channelData": {"tenant": {"id": tenant_id}}}
        resp = self.post(self.CONVERSATION_URL, data=data)
        return resp.get("id")

    def send_message(self, conversation_id, data):
        return self.post(self.ACTIVITY_URL % conversation_id, data=data)

    def update_message(self, conversation_id, activity_id, data):
        return self.put(self.MESSAGE_URL % (conversation_id, activity_id), data=data)

    def send_card(self, conversation_id, card):
        payload = {
            "type": "message",
            "attachments": [
                {"contentType": "application/vnd.microsoft.card.adaptive", "content": card}
            ],
        }
        return self.send_message(conversation_id, payload)

    def update_card(self, conversation_id, activity_id, card):
        payload = {
            "type": "message",
            "attachments": [
                {"contentType": "application/vnd.microsoft.card.adaptive", "content": card}
            ],
        }
        return self.update_message(conversation_id, activity_id, payload)


# MsTeamsPreInstallClient is used with the access token and service url as arguments to the constructor
# It will not handle token refreshing
class MsTeamsPreInstallClient(MsTeamsAbstractClient):
    def __init__(self, access_token, service_url):
        super(MsTeamsPreInstallClient, self).__init__()
        self.access_token = access_token
        self.base_url = service_url.rstrip("/")


# MsTeamsClient is used with an existing integration object and handles token refreshing
class MsTeamsClient(MsTeamsAbstractClient):
    def __init__(self, integration):
        super(MsTeamsClient, self).__init__()
        self.integration = integration

    @property
    def metadata(self):
        return self.integration.metadata

    @property
    def base_url(self):
        return self.metadata["service_url"].rstrip("/")

    @property
    def access_token(self):
        access_token = self.metadata.get("access_token")
        expires_at = self.metadata.get("expires_at")

        # if the token is expired, refresh it and save  it
        if expires_at <= int(time.time()):
            token_data = get_token_data()
            access_token = token_data["access_token"]
            self.metadata.update(token_data)
            self.integration.save()
        return access_token


# OAuthMsTeamsClient is used only for the exchanging the token
class OAuthMsTeamsClient(ApiClient):
    base_url = "https://login.microsoftonline.com/botframework.com"
    integration_name = "msteams"

    TOKEN_URL = "/oauth2/v2.0/token"

    def __init__(self, client_id, client_secret):
        super(OAuthMsTeamsClient, self).__init__()
        self.client_id = client_id
        self.client_secret = client_secret

    def exchange_token(self):
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
            "scope": "https://api.botframework.com/.default",
        }
        return self.post(self.TOKEN_URL, data=urlencode(data), headers=headers, json=False)


def get_token_data():
    client_id = options.get("msteams.client-id")
    client_secret = options.get("msteams.client-secret")
    client = OAuthMsTeamsClient(client_id, client_secret)
    resp = client.exchange_token()
    # calculate the expiration date but offset because of the delay in receiving the response
    expires_at = int(time.time()) + int(resp["expires_in"]) - CLOCK_SKEW
    return {"access_token": resp["access_token"], "expires_at": expires_at}


class MsTeamsJwtClient(ApiClient):
    integration_name = "msteams"
    # 24 hour cache is recommended: https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-authentication?view=azure-bot-service-4.0#connector-to-bot-step-3
    cache_time = 60 * 60 * 24
    OPEN_ID_CONFIG_URL = "https://login.botframework.com/v1/.well-known/openidconfiguration"

    def get_open_id_config(self):
        return self.get_cached(self.OPEN_ID_CONFIG_URL)
