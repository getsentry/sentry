from __future__ import absolute_import

from six.moves.urllib.parse import urlencode
from sentry.integrations.client import ApiClient
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign


class MsTeamsClient(ApiClient):
    integration_name = "msteams"
    # TODO(steve): make base url configurable
    base_url = "https://smba.trafficmanager.net/amer"

    TEAM_URL = "/v3/teams/%s"
    ACTIVITY_URL = "/v3/conversations/%s/activities"

    def __init__(self, access_token=None):
        super(MsTeamsClient, self).__init__()
        # TODO(steve): copy how Github does it
        if not access_token:
            access_token = get_token()
        self.access_token = access_token

    def request(self, method, path, data=None, params=None):
        headers = {"Authorization": u"Bearer {}".format(self.access_token)}
        return self._request(method, path, headers=headers, data=data, params=params)

    def get_team_info(self, team_id):
        return self.get(self.TEAM_URL % team_id)

    def send_message(self, conversation_id, data):
        return self.post(self.ACTIVITY_URL % conversation_id, data=data)

    def send_welcome_message(self, conversation_id):
        # sign the params so this can't be forged
        signed_params = sign(team_id=conversation_id)
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


class OauthMsTeamsClient(ApiClient):
    base_url = "https://login.microsoftonline.com/botframework.com"
    integration_name = "msteams_oauth"

    TOKEN_URL = "/oauth2/v2.0/token"

    def __init__(self, client_id, client_secret):
        super(OauthMsTeamsClient, self).__init__()
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


# TODO(steve): copy how Github does it
def get_token():
    from sentry import options

    client_id = options.get("msteams.client-id")
    client_secret = options.get("msteams.client-secret")
    client = OauthMsTeamsClient(client_id, client_secret)
    resp = client.exchange_token()
    return resp["access_token"]
