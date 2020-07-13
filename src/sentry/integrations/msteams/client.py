from __future__ import absolute_import

import time

from six.moves.urllib.parse import urlencode

from sentry import options
from sentry.integrations.client import ApiClient
from sentry.utils.http import absolute_uri


# one minute
EXPIRATION_OFFSET = 60


# this abstract client does not handle setting the base url or auth token
class MsTeamsAbstractClient(ApiClient):
    integration_name = "msteams"
    TEAM_URL = "/v3/teams/%s"
    ACTIVITY_URL = "/v3/conversations/%s/activities"

    def request(self, method, path, data=None, params=None):
        headers = {"Authorization": u"Bearer {}".format(self.access_token)}
        return self._request(method, path, headers=headers, data=data, params=params)

    def get_team_info(self, team_id):
        return self.get(self.TEAM_URL % team_id)

    def send_message(self, conversation_id, data):
        return self.post(self.ACTIVITY_URL % conversation_id, data=data)

    def send_welcome_message(self, conversation_id, signed_params):
        url = u"%s?signed_params=%s" % (
            absolute_uri("/extensions/msteams/configure/"),
            signed_params,
        )
        # TODO: Refactor message creation
        # TODO: Tweak welcome message appearance to perfection
        logo = {
            "type": "Image",
            "url": "https://sentry-brand.storage.googleapis.com/sentry-glyph-black.png",
            "size": "Medium",
        }
        welcome = {
            "type": "TextBlock",
            "weight": "Bolder",
            "size": "Large",
            "text": "Welcome to Sentry for Teams!",
            "wrap": True,
        }
        description = {
            "type": "TextBlock",
            "text": "The Sentry app for Teams allows you to be notified in real-time when an error pops up, using customizable alert rules.",
            "wrap": True,
        }
        instruction = {
            "type": "TextBlock",
            "text": "Please click [here](%s) to get started with using Sentry for Microsoft Teams."
            % url,
            "wrap": True,
        }
        card = {
            "type": "AdaptiveCard",
            "body": [
                {
                    "type": "ColumnSet",
                    "columns": [
                        {"type": "Column", "items": [logo], "width": "auto"},
                        {
                            "type": "Column",
                            "items": [welcome],
                            "width": "stretch",
                            "verticalContentAlignment": "Center",
                        },
                    ],
                },
                description,
                instruction,
            ],
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
        }
        payload = {
            "type": "message",
            "attachments": [
                {"contentType": "application/vnd.microsoft.card.adaptive", "content": card}
            ],
        }
        self.send_message(conversation_id, payload)


class MsTeamsClient(MsTeamsAbstractClient):
    def __init__(self, access_token, service_url):
        super(MsTeamsClient, self).__init__()
        self.access_token = access_token
        self.base_url = service_url.rstrip("/")


class MsTeamsIntegrationClient(MsTeamsAbstractClient):
    def __init__(self, integration):
        super(MsTeamsIntegrationClient, self).__init__()
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


class OAuthMsTeamsClient(ApiClient):
    base_url = "https://login.microsoftonline.com/botframework.com"
    integration_name = "msteams_oauth"

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
    expires_at = int(time.time()) + int(resp["expires_in"]) - EXPIRATION_OFFSET
    return {"access_token": resp["access_token"], "expires_at": expires_at}
