from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from unittest.mock import MagicMock, patch

import jwt
import responses
from rest_framework import status

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import ProjectManagementFailuresReason
from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    get_query_hash,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.http import absolute_uri
from tests.sentry.utils.test_jwt import RS256_KEY, RS256_PUB_KEY


@control_silo_test
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

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    def test_missing_body(self, mock_record_failure):
        self.get_error_response(
            extra_headers=dict(HTTP_AUTHORIZATION="JWT anexampletoken"),
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        mock_record_failure.assert_called_with(
            ProjectManagementFailuresReason.INSTALLATION_STATE_MISSING
        )

    def test_missing_token(self):
        self.get_error_response(**self.body(), status_code=status.HTTP_409_CONFLICT)

    def test_invalid_token(self):
        self.get_error_response(
            **self.body(),
            extra_headers=dict(HTTP_AUTHORIZATION="invalid"),
            status_code=status.HTTP_409_CONFLICT,
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
            status_code=status.HTTP_409_CONFLICT,
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry_sdk.set_tag")
    def test_with_shared_secret(self, mock_set_tag: MagicMock, mock_record_event):
        self.get_success_response(
            **self.body(),
            extra_headers=dict(HTTP_AUTHORIZATION="JWT " + self.jwt_token_secret()),
        )
        integration = Integration.objects.get(provider="jira", external_id=self.external_id)

        mock_set_tag.assert_any_call("integration_id", integration.id)
        assert integration.status == ObjectStatus.ACTIVE
        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None)

    @patch("sentry_sdk.set_tag")
    @responses.activate
    def test_with_key_id(self, mock_set_tag: MagicMock):
        self.add_response()

        self.get_success_response(
            **self.body(),
            extra_headers=dict(HTTP_AUTHORIZATION="JWT " + self.jwt_token_cdn()),
        )
        integration = Integration.objects.get(provider="jira", external_id=self.external_id)

        mock_set_tag.assert_any_call("integration_id", integration.id)
        assert integration.status == ObjectStatus.ACTIVE
