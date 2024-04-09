from unittest import mock
from unittest.mock import call, patch
from urllib.parse import urlencode

import pytest
import responses
from django.test import override_settings

from sentry.integrations.msteams.client import MsTeamsClient
from sentry.models.integrations.integration import Integration
from sentry.silo.base import SiloMode
from sentry.silo.util import (
    PROXY_BASE_PATH,
    PROXY_BASE_URL_HEADER,
    PROXY_OI_HEADER,
    PROXY_PATH,
    PROXY_SIGNATURE_HEADER,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from tests.sentry.integrations.test_helpers import add_control_silo_proxy_response


@control_silo_test
class MsTeamsClientTest(TestCase):
    @pytest.fixture(autouse=True)
    def _setup_metric_patch(self):
        with mock.patch("sentry.shared_integrations.track_response.metrics") as self.metrics:
            yield

    def setUp(self):
        self.expires_at = 1594768808
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="msteams",
            external_id="foobar",
            name="my_team",
            metadata={
                "access_token": "my_token",
                "expires_at": self.expires_at,
                "service_url": "https://smba.trafficmanager.net/amer/",
            },
        )

        responses.add(
            responses.GET,
            "https://smba.trafficmanager.net/amer/v3/teams/foobar",
            json={},
        )

        # token mock
        access_json = {"expires_in": 86399, "access_token": "my_new_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )

        self.msteams_client = MsTeamsClient(self.integration)

    @responses.activate
    def test_token_refreshes(self):
        with patch("time.time") as mock_time:
            mock_time.return_value = self.expires_at
            # accessing the property should refresh the token
            self.msteams_client.access_token
            body = responses.calls[0].request.body
            assert body == urlencode(
                {
                    "client_id": "msteams-client-id",
                    "client_secret": "msteams-client-secret",
                    "grant_type": "client_credentials",
                    "scope": "https://api.botframework.com/.default",
                }
            )

            integration = Integration.objects.get(provider="msteams")
            assert integration.metadata == {
                "access_token": "my_new_token",
                "expires_at": self.expires_at + 86399 - 60 * 5,
                "service_url": "https://smba.trafficmanager.net/amer/",
            }

    @responses.activate
    def test_no_token_refresh(self):
        with patch("time.time") as mock_time:
            mock_time.return_value = self.expires_at - 100
            # accessing the property should refresh the token
            self.msteams_client.access_token
            assert not responses.calls

            integration = Integration.objects.get(provider="msteams")
            assert integration.metadata == {
                "access_token": "my_token",
                "expires_at": self.expires_at,
                "service_url": "https://smba.trafficmanager.net/amer/",
            }

    @responses.activate
    def test_simple(self):
        self.msteams_client.get_team_info("foobar")
        assert len(responses.calls) == 2
        token_request = responses.calls[0].request

        # Token request
        assert (
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"
            == token_request.url
        )

        # API request to service url
        request = responses.calls[1].request
        assert "https://smba.trafficmanager.net/amer/v3/teams/foobar" == request.url
        assert self.msteams_client.base_url in request.url

        # Check if metrics is generated properly
        calls = [
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "msteams", "status": 200},
            ),
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "msteams", "status": 200},
            ),
        ]
        assert self.metrics.incr.mock_calls == calls

    @responses.activate
    def test_api_client_from_integration_installation(self):
        installation = self.integration.get_installation(organization_id=self.organization.id)
        client = installation.get_client()
        assert isinstance(client, MsTeamsClient)

        client.get_team_info("foobar")
        assert len(responses.calls) == 2
        token_request = responses.calls[0].request

        # Token request
        assert (
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"
            == token_request.url
        )

        # API request to service url
        request = responses.calls[1].request
        assert "https://smba.trafficmanager.net/amer/v3/teams/foobar" == request.url
        assert self.msteams_client.base_url in request.url

        # Check if metrics is generated properly
        calls = [
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "msteams", "status": 200},
            ),
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "msteams", "status": 200},
            ),
        ]
        assert self.metrics.incr.mock_calls == calls


def assert_proxy_request(request, is_proxy=True):
    assert (PROXY_BASE_PATH in request.url) == is_proxy
    assert (PROXY_OI_HEADER in request.headers) == is_proxy
    assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
    assert ("Authorization" in request.headers) != is_proxy
    if is_proxy:
        assert request.headers[PROXY_OI_HEADER] is not None


@override_settings(
    SENTRY_SUBNET_SECRET="hush-hush-im-invisible",
    SENTRY_CONTROL_ADDRESS="http://controlserver",
)
class MsTeamsProxyApiClientTest(TestCase):
    def setUp(self):
        self.expires_at = 1594768808
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="msteams",
            external_id="foobar",
            name="my_team",
            metadata={
                "access_token": "my_token",
                "expires_at": self.expires_at,
                "service_url": "https://smba.trafficmanager.net/amer/",
            },
        )

        access_json = {"expires_in": 86399, "access_token": "my_new_token"}
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )
        responses.add(
            responses.GET,
            "https://smba.trafficmanager.net/amer/v3/teams/foobar",
            json={},
        )
        self.control_proxy_response = add_control_silo_proxy_response(
            method=responses.GET,
            path="v3/teams/foobar",
            json={},
        )

    @responses.activate
    def test_integration_proxy_is_active(self):
        class MsTeamsProxyApiTestClient(MsTeamsClient):
            _use_proxy_url_for_tests = True

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = MsTeamsProxyApiTestClient(self.integration)
            client.get_team_info("foobar")
            assert len(responses.calls) == 2
            token_request = responses.calls[0].request

            # Token request
            assert (
                "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"
                == token_request.url
            )

            # API request to service url
            request = responses.calls[1].request
            assert "https://smba.trafficmanager.net/amer/v3/teams/foobar" == request.url
            assert client.base_url in request.url
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = MsTeamsProxyApiTestClient(self.integration)
            client.get_team_info("foobar")
            assert len(responses.calls) == 2
            token_request = responses.calls[0].request

            # Token request
            assert (
                "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"
                == token_request.url
            )

            # API request to service url
            request = responses.calls[1].request
            assert "https://smba.trafficmanager.net/amer/v3/teams/foobar" == request.url
            assert client.base_url in request.url
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = MsTeamsProxyApiTestClient(self.integration)
            client.get_team_info("foobar")
            assert len(responses.calls) == 1

            # API request to service url
            request = responses.calls[0].request
            assert self.control_proxy_response.call_count == 1
            assert request.headers[PROXY_PATH] == "v3/teams/foobar"
            assert request.headers[PROXY_BASE_URL_HEADER] == "https://smba.trafficmanager.net/amer"
            assert client.base_url not in request.url
            assert_proxy_request(request, is_proxy=True)
