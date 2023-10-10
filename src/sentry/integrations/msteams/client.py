from __future__ import annotations

import time
from urllib.parse import urlencode

from requests import PreparedRequest

from sentry import options
from sentry.integrations.client import ApiClient
from sentry.models.integrations import Integration
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.shared_integrations.client.proxy import IntegrationProxyClient, infer_org_integration
from sentry.silo.base import SiloMode

# five minutes which is industry standard clock skew tolerance
CLOCK_SKEW = 60 * 5


# MsTeamsClientMixin abstract client does not handle setting the base url or auth token
class MsTeamsClientMixin:
    integration_name = "msteams"
    TEAM_URL = "/v3/teams/%s"
    CHANNEL_URL = "/v3/teams/%s/conversations"
    ACTIVITY_URL = "/v3/conversations/%s/activities"
    MESSAGE_URL = "/v3/conversations/%s/activities/%s"
    CONVERSATION_URL = "/v3/conversations"
    MEMBER_URL = "/v3/conversations/%s/pagedmembers"

    def get_team_info(self, team_id: str):
        return self.get(self.TEAM_URL % team_id)

    def get_channel_list(self, team_id: str):
        resp = self.get(self.CHANNEL_URL % team_id)
        return resp.get("conversations")

    def get_member_list(self, team_id: str, continuation_token: str | None = None):
        url = self.MEMBER_URL % team_id
        params = {"pageSize": 500}
        if continuation_token:
            params["continuationToken"] = continuation_token
        return self.get(url, params=params)

    def get_user_conversation_id(self, user_id: str, tenant_id: str):
        data = {"members": [{"id": user_id}], "channelData": {"tenant": {"id": tenant_id}}}
        resp = self.post(self.CONVERSATION_URL, data=data)
        return resp.get("id")

    def send_message(self, conversation_id: str, data):
        return self.post(self.ACTIVITY_URL % conversation_id, data=data)

    def update_message(self, conversation_id: str, activity_id: str, data):
        return self.put(self.MESSAGE_URL % (conversation_id, activity_id), data=data)

    def send_card(self, conversation_id: str, card):
        payload = {
            "type": "message",
            "attachments": [
                {"contentType": "application/vnd.microsoft.card.adaptive", "content": card}
            ],
        }
        return self.send_message(conversation_id, payload)

    def update_card(self, conversation_id: str, activity_id: str, card):
        payload = {
            "type": "message",
            "attachments": [
                {"contentType": "application/vnd.microsoft.card.adaptive", "content": card}
            ],
        }
        return self.update_message(conversation_id, activity_id, payload)


# MsTeamsPreInstallClient is used with the access token and service url as arguments to the constructor
# It will not handle token refreshing
class MsTeamsPreInstallClient(ApiClient, MsTeamsClientMixin):
    integration_name = "msteams"

    def __init__(self, access_token: str, service_url: str):
        super().__init__()
        self.access_token = access_token
        self.base_url = service_url.rstrip("/")

    def request(self, method, path, data=None, params=None):
        headers = {"Authorization": f"Bearer {self.access_token}"}
        return self._request(method, path, headers=headers, data=data, params=params)


# MsTeamsClient is used with an existing integration object and handles token refreshing
class MsTeamsClient(IntegrationProxyClient, MsTeamsClientMixin):
    integration_name = "msteams"

    def __init__(self, integration: Integration | RpcIntegration):
        self.integration = integration
        org_integration_id = infer_org_integration(integration_id=integration.id)
        super().__init__(org_integration_id=org_integration_id)

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

        # We don't refresh the access token in region silos.
        if SiloMode.get_current_mode() != SiloMode.REGION:
            # if the token is expired, refresh it and save  it
            if expires_at <= int(time.time()):
                from copy import deepcopy

                new_metadata = deepcopy(self.integration.metadata)

                token_data = get_token_data()
                access_token = token_data["access_token"]
                new_metadata.update(token_data)

                self.integration = integration_service.update_integration(
                    integration_id=self.integration.id,
                    metadata=new_metadata,
                )
        return access_token

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        prepared_request.headers["Authorization"] = f"Bearer {self.access_token}"
        return prepared_request


# OAuthMsTeamsClient is used only for the exchanging the token
class OAuthMsTeamsClient(ApiClient):
    base_url = "https://login.microsoftonline.com/botframework.com"
    integration_name = "msteams"

    TOKEN_URL = "/oauth2/v2.0/token"

    def __init__(self, client_id, client_secret):
        super().__init__()
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
