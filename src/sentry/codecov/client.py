import datetime
import logging
from collections.abc import Mapping
from typing import TypeAlias

import requests
from rest_framework import status

from sentry import options
from django.conf import settings
from sentry.api.exceptions import SentryAPIException
from sentry.utils import jwt

GitProviderId: TypeAlias = str
GitProviderToken: TypeAlias = str


logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 10


class ConfigurationError(SentryAPIException):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "configuration-error"


class CodecovApiClient:
    """
    Thin client for making JWT-authenticated requests to the Codecov API.

    For each request, Sentry creates a JWT with a key shared with Codecov. This
    JWT contains information that Codecov needs to service the request: OAuth
    token(s) for the current Sentry user's linked git provider account(s), and
    git provider IDs for the current context's relevant git provider accounts
    and organizations.
    """

    def _create_jwt(self):
        now = int(datetime.datetime.now(datetime.UTC).timestamp())
        exp = now + 300  # 5 minutes
        claims = {
            "iss": "https://sentry.io",
            "iat": now,
            "exp": exp,
        }
        claims.update(self.custom_claims)

        return jwt.encode(claims, settings.CODECOV_JWT_SECRET_KEY, algorithm="HS256")

    def __init__(
        self,
        git_provider_users: Mapping[GitProviderId, GitProviderToken],
        git_provider_orgs: list[GitProviderId],
    ):

        if not (base_url := options.get("codecov.base-url")):
            raise ConfigurationError()

        self.base_url = base_url
        self.custom_claims = {
            "g_u": git_provider_users,
            "g_o": git_provider_orgs,
        }

    def get(self, endpoint: str, params=None, headers=None) -> requests.Response | None:
        headers = headers or {}
        headers.update({"Authorization": f"Bearer {self._create_jwt()}"})

        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT_SECONDS)
        except Exception:
            logger.exception("Error when making GET request")
            return None

        return response

    def post(self, endpoint: str, data=None, headers=None) -> requests.Response | None:
        headers = headers or {}
        headers.update({"Authorization": f"Bearer {self._create_jwt()}"})
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.post(url, data=data, headers=headers, timeout=TIMEOUT_SECONDS)
        except Exception:
            logger.exception("Error when making GET request")
            return None

        return response
