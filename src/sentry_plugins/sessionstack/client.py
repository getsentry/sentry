import requests

from sentry.http import safe_urlopen
from sentry.utils import json

from .utils import add_query_params, get_basic_auth, remove_trailing_slashes

ACCESS_TOKEN_NAME = "Sentry"
DEFAULT_SENTRY_SOURCE = "sentry"

API_URL = "https://api.sessionstack.com"
PLAYER_URL = "https://app.sessionstack.com/player"

WEBSITES_ENDPOINT = "/v1/websites/{}"
SESSION_ENDPOINT = "/v1/websites/{}/sessions/{}"
ACCESS_TOKENS_ENDPOINT = "/v1/websites/{}/sessions/{}/access_tokens"
SESSION_URL_PATH = "/#/sessions/"

MILLISECONDS_BEFORE_EVENT = 5000


class SessionStackClient:
    def __init__(self, account_email, api_token, website_id, **kwargs):
        self.website_id = website_id

        api_url = kwargs.get("api_url") or API_URL
        self.api_url = remove_trailing_slashes(api_url)

        player_url = kwargs.get("player_url") or PLAYER_URL
        self.player_url = remove_trailing_slashes(player_url)

        self.request_headers = {
            "Authorization": get_basic_auth(account_email, api_token),
            "Content-Type": "application/json",
        }

    def validate_api_access(self):
        website_endpoint = WEBSITES_ENDPOINT.format(self.website_id)

        try:
            response = self._make_request(website_endpoint, "GET")
        except requests.exceptions.ConnectionError:
            raise InvalidApiUrlError

        if response.status_code == requests.codes.UNAUTHORIZED:
            raise UnauthorizedError
        elif response.status_code == requests.codes.BAD_REQUEST:
            raise InvalidWebsiteIdError
        elif response.status_code == requests.codes.NOT_FOUND:
            raise InvalidApiUrlError

        response.raise_for_status()

    def get_session_url(self, session_id, event_timestamp):

        player_url = self.player_url + SESSION_URL_PATH + session_id
        query_params = {}
        query_params["source"] = DEFAULT_SENTRY_SOURCE

        access_token = self._get_access_token(session_id)
        if access_token is not None:
            query_params["access_token"] = access_token

        if event_timestamp is not None:
            start_timestamp = self._get_session_start_timestamp(session_id)
            if start_timestamp is not None:
                pause_at = event_timestamp - start_timestamp
                play_from = pause_at - MILLISECONDS_BEFORE_EVENT

                query_params["pause_at"] = pause_at
                query_params["play_from"] = play_from

        return add_query_params(player_url, query_params)

    def _get_access_token(self, session_id):
        access_token = self._create_access_token(session_id)
        if not access_token:
            access_token = self._get_existing_access_token(session_id)

        return access_token

    def _get_existing_access_token(self, session_id):
        response = self._make_access_tokens_request(session_id, "GET")

        if response.status_code != requests.codes.OK:
            return None

        access_tokens = json.loads(response.content).get("data")
        for token in access_tokens:
            token_name = token.get("name")
            if token_name == ACCESS_TOKEN_NAME:
                return token.get("access_token")

        return None

    def _create_access_token(self, session_id):
        response = self._make_access_tokens_request(
            session_id=session_id, method="POST", body={"name": ACCESS_TOKEN_NAME}
        )

        if response.status_code != requests.codes.OK:
            return None

        return json.loads(response.content).get("access_token")

    def _make_access_tokens_request(self, session_id, method, **kwargs):
        access_tokens_endpoint = self._get_access_tokens_endpoint(session_id)
        return self._make_request(access_tokens_endpoint, method, **kwargs)

    def _get_access_tokens_endpoint(self, session_id):
        return ACCESS_TOKENS_ENDPOINT.format(self.website_id, session_id)

    def _get_session_start_timestamp(self, session_id):
        endpoint = SESSION_ENDPOINT.format(self.website_id, session_id)
        response = self._make_request(endpoint, "GET")

        if response.status_code == requests.codes.OK:
            return json.loads(response.content).get("client_start")

    def _make_request(self, endpoint, method, **kwargs):
        url = self.api_url + endpoint

        request_kwargs = {"method": method, "headers": self.request_headers}

        body = kwargs.get("body")
        if body:
            request_kwargs["json"] = body

        return safe_urlopen(url, **request_kwargs)


class UnauthorizedError(Exception):
    pass


class InvalidWebsiteIdError(Exception):
    pass


class InvalidApiUrlError(Exception):
    pass
