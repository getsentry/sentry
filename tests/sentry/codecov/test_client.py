import datetime
from unittest.mock import patch

import pytest
from django.test import override_settings

from sentry.codecov.client import CodecovApiClient, ConfigurationError, GitProvider
from sentry.testutils.cases import TestCase
from sentry.utils import jwt


@override_settings(CODECOV_API_BASE_URL="http://example.com")
class TestCodecovApiClient(TestCase):
    def setUp(self):
        self.test_git_provider_org = "test-org"
        self.test_secret = "test-secret-" + "a" * 20

        self.test_timestamp = datetime.datetime.now(datetime.UTC)
        self._mock_now = patch("datetime.datetime.now", return_value=self.test_timestamp)

        with self.options(
            {
                "codecov.api-bridge-signing-secret": self.test_secret,
            }
        ):
            self.codecov_client = CodecovApiClient(self.test_git_provider_org)

    def test_raises_configuration_error_without_signing_secret(self):
        with self.options(
            {
                "codecov.api-bridge-signing-secret": None,
            }
        ):
            with pytest.raises(ConfigurationError):
                CodecovApiClient(self.test_git_provider_org)

    def test_creates_valid_jwt(self):
        encoded_jwt = self.codecov_client._create_jwt()

        header = jwt.peek_header(encoded_jwt)
        assert header == {
            "typ": "JWT",
            "alg": "HS256",
        }

        # Ensure the claims are what we expect, separate from verifying the
        # signature and standard claims
        claims = jwt.peek_claims(encoded_jwt)
        expected_iat = int(self.test_timestamp.timestamp())
        expected_exp = expected_iat + 300
        assert claims == {
            "g_o": self.test_git_provider_org,
            "g_p": GitProvider.GitHub.value,
            "iss": "https://sentry.io",
            "iat": expected_iat,
            "exp": expected_exp,
        }

        # Ensure we can verify the signature and whatall
        jwt.decode(encoded_jwt, self.test_secret)

    @patch("requests.get")
    def test_sends_get_request_with_jwt_auth_header(self, mock_get):
        with patch.object(self.codecov_client, "_create_jwt", return_value="test"):
            self.codecov_client.get(
                "/example/endpoint", {"example-param": "foo"}, {"X_TEST_HEADER": "bar"}
            )
            mock_get.assert_called_once_with(
                "http://example.com/example/endpoint",
                params={"example-param": "foo"},
                headers={
                    "Authorization": "Bearer test",
                    "X_TEST_HEADER": "bar",
                },
                timeout=10,
            )

    @patch("requests.post")
    def test_sends_post_request_with_jwt_auth_header(self, mock_post):
        with patch.object(self.codecov_client, "_create_jwt", return_value="test"):
            self.codecov_client.post(
                "/example/endpoint", data={"example-param": "foo"}, headers={"X_TEST_HEADER": "bar"}
            )
            mock_post.assert_called_once_with(
                "http://example.com/example/endpoint",
                data={"example-param": "foo"},
                json=None,
                headers={
                    "Authorization": "Bearer test",
                    "X_TEST_HEADER": "bar",
                },
                timeout=10,
            )

    @patch("requests.post")
    def test_query_sends_post_request_with_jwt_auth_header(self, mock_post):
        with patch.object(self.codecov_client, "_create_jwt", return_value="test"):
            self.codecov_client.query("query { test }", {"test": "test"}, GitProvider.GitHub)
            mock_post.assert_called_once_with(
                "http://example.com/graphql/sentry/github",
                data=None,
                json={"query": "query { test }", "variables": {"test": "test"}},
                headers={
                    "Content-Type": "application/json; charset=utf-8",
                    "Accept": "application/json",
                    "Token-Type": "github-token",
                    "Authorization": "Bearer test",
                },
                timeout=10,
            )
