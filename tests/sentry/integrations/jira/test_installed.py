from __future__ import annotations

from typing import Any, Mapping
from unittest.mock import patch

import jwt
import responses
from rest_framework import status

from sentry.constants import ObjectStatus
from sentry.integrations.utils import AtlassianConnectValidationError, get_query_hash
from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri
from tests.sentry.utils.test_jwt import RS256_KEY, RS256_PUB_KEY


class JiraInstalledTest(APITestCase):
    endpoint = "sentry-extensions-jira-installed"
    method = "post"
    external_id = "it2may+cody"
    kid = "cudi"
    shared_secret = "garden"
    path = "/extensions/jira/installed/"

    def _jwt_token(
        self,
        jira_signing_algorithm: str,
        data: str,
        headers: Mapping[str, Any] | None = None,
    ) -> str:
        return jwt.encode(
            {
                "iss": self.external_id,
                "aud": absolute_uri(),
                "qsh": get_query_hash(self.path, method="POST", query_params={}),
            },
            data,
            algorithm=jira_signing_algorithm,
            headers={**(headers or {}), "alg": jira_signing_algorithm},
        )

    def jwt_token_secret(self):
        return self._jwt_token("HS256", self.shared_secret)

    def jwt_token_cdn(self):
        return self._jwt_token("RS256", RS256_KEY, headers={"kid": self.kid})

    def body(self) -> Mapping[str, Any]:
        return {
            "jira": {
                "metadata": {},
                "external_id": self.external_id,
            },
            "clientKey": "limepie",
            "oauthClientId": "EFG",
            "publicKey": "yourCar",
            "sharedSecret": self.shared_secret,
            "baseUrl": "https://sentry.io.org.xyz.online.dev.sentry.io",
        }

    def add_response(self) -> None:
        responses.add(
            responses.GET,
            f"https://connect-install-keys.atlassian.com/{self.kid}",
            body=RS256_PUB_KEY,
        )

    def test_missing_body(self):
        self.get_error_response(
            extra_headers=dict(HTTP_AUTHORIZATION="JWT anexampletoken"),
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def test_missing_token(self):
        self.get_error_response(**self.body(), status_code=status.HTTP_400_BAD_REQUEST)

    def test_invalid_token(self):
        self.get_error_response(
            **self.body(),
            extra_headers=dict(HTTP_AUTHORIZATION="invalid"),
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    @patch(
        "sentry.integrations.jira.webhooks.installed.authenticate_asymmetric_jwt",
        side_effect=AtlassianConnectValidationError(),
    )
    @responses.activate
    def test_no_claims(self, mock_authenticate_asymmetric_jwt):
        self.add_response()

        self.get_error_response(
            **self.body(),
            extra_headers=dict(HTTP_AUTHORIZATION="JWT " + self.jwt_token_cdn()),
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def test_with_shared_secret(self):
        self.get_success_response(
            **self.body(),
            extra_headers=dict(HTTP_AUTHORIZATION="JWT " + self.jwt_token_secret()),
        )
        integration = Integration.objects.get(provider="jira", external_id=self.external_id)
        assert integration.status == ObjectStatus.VISIBLE

    @responses.activate
    def test_with_key_id(self):
        self.add_response()

        self.get_success_response(
            **self.body(),
            extra_headers=dict(HTTP_AUTHORIZATION="JWT " + self.jwt_token_cdn()),
        )
        integration = Integration.objects.get(provider="jira", external_id=self.external_id)
        assert integration.status == ObjectStatus.VISIBLE
