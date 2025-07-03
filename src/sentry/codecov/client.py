import datetime
import logging
from enum import StrEnum
from typing import TypeAlias

import requests
from django.conf import settings
from rest_framework import status

from sentry import options
from sentry.api.exceptions import SentryAPIException
from sentry.integrations.types import IntegrationProviderSlug
from sentry.utils import jwt

GitProviderId: TypeAlias = str


class GitProvider(StrEnum):
    """
    Enum representing the Git provider that hosts the user/org that a
    `CodecovApiClient` instance is acting on behalf of.

    Codecov doesn't require this to be GitHub, but that's all that's implemented
    for now.
    """

    GitHub = IntegrationProviderSlug.GITHUB


logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 10
JWT_VALIDITY_WINDOW_SECONDS = 300  # 5 minutes


class ConfigurationError(SentryAPIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "configuration-error"


class CodecovApiClient:
    """
    Thin client for making JWT-authenticated requests to the Codecov API.

    For each request, Sentry creates and signs (HS256) a JWT with a key shared
    with Codecov. This JWT contains information that Codecov needs to service
    the request.
    """

    def _create_jwt(self):
        now = int(datetime.datetime.now(datetime.UTC).timestamp())
        exp = now + JWT_VALIDITY_WINDOW_SECONDS
        claims = {
            "iss": "https://sentry.io",
            "iat": now,
            "exp": exp,
        }
        claims.update(self.custom_claims)

        return jwt.encode(claims, self.signing_secret, algorithm="HS256")

    def __init__(
        self,
        git_provider_org: GitProviderId,
        git_provider: GitProvider = GitProvider.GitHub,
    ):
        """
        Creates a `CodecovApiClient`.

        :param git_provider_org: The organization slug for the git provider.
        :param git_provider: The git provider that the above user's account is
           hosted on.
        """

        if not (signing_secret := options.get("codecov.api-bridge-signing-secret")):
            raise ConfigurationError()

        self.base_url = settings.CODECOV_API_BASE_URL
        self.signing_secret = signing_secret
        self.custom_claims = {
            "g_o": git_provider_org,
            "g_p": git_provider,
        }

    def get(self, endpoint: str, params=None, headers=None) -> requests.Response:
        """
        Makes a GET request to the specified endpoint of the configured Codecov
        API host with the provided params and headers.

        :param endpoint: The endpoint to request, without the host portion. For
           example: `/api/v2/gh/getsentry/users` or `/graphql`
        :param params: Dictionary of query params.
        :param headers: Dictionary of request headers.
        """
        headers = headers or {}
        token = self._create_jwt()
        headers.update(jwt.authorization_header(token))

        url = f"{self.base_url}{endpoint}"
        try:
            response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT_SECONDS)
        except Exception:
            logger.exception("Error when making GET request")
            raise

        return response

    def post(self, endpoint: str, data=None, json=None, headers=None) -> requests.Response:
        """
        Makes a POST request to the specified endpoint of the configured Codecov
        API host with the provided data and headers.

        :param endpoint: The endpoint to request, without the host portion. For
           example: `/api/v2/gh/getsentry/users` or `/graphql`
        :param data: Dictionary of form data.
        :param headers: Dictionary of request headers.
        """
        headers = headers or {}
        token = self._create_jwt()
        headers.update(jwt.authorization_header(token))
        url = f"{self.base_url}{endpoint}"
        try:
            response = requests.post(
                url, data=data, json=json, headers=headers, timeout=TIMEOUT_SECONDS
            )
        except Exception:
            logger.exception("Error when making POST request")
            raise

        return response

    def query(
        self, query: str, variables: dict, provider: GitProvider = GitProvider.GitHub
    ) -> requests.Response:
        """
        Convenience method for making a GraphQL query to the Codecov API, using the post method of this client.
        This method is used to make GraphQL queries to the Codecov API. Adds headers similar to what's done in Gazebo,
        hardcoding the token type because we only need to support github tokens for now.

        For reference, see: https://github.com/codecov/gazebo/blob/67df9ca2014b0dbf5cb4ed88ae9be50275d800db/src/shared/api/helpers.ts#L66

        :param query: The GraphQL query to make.
        :param variables: The variables to pass to the query.
        :return: The response from the Codecov API.
        """

        json = {
            "query": query,
            "variables": variables,
        }

        return self.post(
            f"/graphql/sentry/{provider.value}",
            json=json,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "Token-Type": f"{provider.value}-token",
            },
        )
