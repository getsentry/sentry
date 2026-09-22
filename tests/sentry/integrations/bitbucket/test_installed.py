from __future__ import annotations

from typing import Any
from unittest import mock
from urllib.parse import urlsplit

import responses
from rest_framework.response import Response

from sentry.integrations.bitbucket.client import BitbucketApiClient
from sentry.integrations.bitbucket.installed import BitbucketInstalledEndpoint
from sentry.integrations.bitbucket.integration import BitbucketIntegrationProvider, scopes
from sentry.integrations.models.integration import Integration
from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.models.repository import Repository
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import jwt


@control_silo_test
class BitbucketInstalledEndpointTest(APITestCase):
    def setUp(self) -> None:
        self.provider = "bitbucket"
        self.path = "/extensions/bitbucket/installed/"
        self.username = "sentryuser"
        self.client_key = "connection:123"
        self.public_key = "123abcDEFg"
        self.shared_secret = "G12332434SDfsjkdfgsd"
        self.base_api_url = "https://api.bitbucket.org"
        self.base_url = "https://bitbucket.org"
        self.domain_name = "bitbucket.org/sentryuser"
        self.user_display_name = "Sentry User"
        self.team_display_name = self.username
        self.icon = "https://bitbucket.org/account/sentryuser/avatar/32/"

        self.team_data = {
            "username": self.username,
            "display_name": self.team_display_name,
            "account_id": "123456t256371u",
            "links": {
                "self": {"href": "https://api.bitbucket.org/2.0/users/sentryuser/"},
                "html": {
                    "href": "https://bitbucket.org/%8Cde3c29fa-c919-4b59-8c43-59febd16a8e7%7D/"
                },
                "avatar": {"href": "https://bitbucket.org/account/sentryuser/avatar/32/"},
            },
            "created_on": "2018-04-18T00:46:37.374621+00:00",
            "type": "team",
            "uuid": "{e123f456-c789-4a10-b123-456789abcdef}",
        }
        self.user_data = self.team_data.copy()
        self.user_data["type"] = "user"

        self.user_data["display_name"] = self.user_display_name

        self.metadata = {
            "public_key": self.public_key,
            "shared_secret": self.shared_secret,
            "domain_name": self.domain_name,
            "icon": self.icon,
            "scopes": list(scopes),
            "type": self.team_data["type"],
            "uuid": self.team_data["uuid"],
        }

        self.user_metadata = self.metadata.copy()
        self.user_metadata["type"] = self.user_data["type"]
        self.user_metadata["domain_name"] = self.user_display_name

        self.team_data_from_bitbucket: dict[str, Any] = {
            "key": "sentry-bitbucket",
            "eventType": "installed",
            "baseUrl": self.base_url,
            "sharedSecret": self.shared_secret,
            "publicKey": self.public_key,
            "user": self.team_data,
            "productType": "bitbucket",
            "baseApiUrl": self.base_api_url,
            "clientKey": self.client_key,
            "principal": self.team_data,
        }
        self.user_data_from_bitbucket = self.team_data_from_bitbucket.copy()
        self.user_data_from_bitbucket["principal"] = self.user_data

        self.data_without_public_key = {"identity": {"bitbucket_client_id": self.client_key}}

    def test_default_permissions(self) -> None:
        # Permissions must be empty so that it will be accessible to bitbucket.
        assert BitbucketInstalledEndpoint.authentication_classes == ()
        assert BitbucketInstalledEndpoint.permission_classes == ()

    def install(self, data: dict[str, Any]) -> Response:
        with mock.patch.object(BitbucketApiClient, "get_workspace_hooks"):
            return self.client.post(self.path, data=data)

    def test_installed_with_public_key(self) -> None:
        response = self.install(self.team_data_from_bitbucket)
        assert response.status_code == 200
        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)
        assert integration.name == self.username
        del integration.metadata["webhook_secret"]
        assert integration.metadata == self.metadata

    def test_existing_installation_without_username(self) -> None:
        integration, created = Integration.objects.get_or_create(
            provider=self.provider,
            external_id=self.client_key,
            defaults={"name": self.user_display_name, "metadata": self.user_metadata},
        )
        del self.user_data_from_bitbucket["principal"]["username"]
        token = jwt.encode(
            {
                "iss": self.client_key,
                "qsh": get_query_hash(self.path, method="POST", query_params={}),
            },
            self.shared_secret,
        )
        response = self.client.post(
            self.path,
            data=self.user_data_from_bitbucket,
            HTTP_AUTHORIZATION=f"JWT {token}",
        )
        assert response.status_code == 200

        # assert no changes have been made to the integration
        integration_after = Integration.objects.get(
            provider=self.provider, external_id=self.client_key
        )
        assert integration.name == integration_after.name
        del integration_after.metadata["webhook_secret"]
        assert integration.metadata == integration_after.metadata

    def test_installed_without_username(self) -> None:
        """Test a user (not team) installation where the user has hidden their username from public view"""

        # Remove username to simulate privacy mode
        del self.user_data_from_bitbucket["principal"]["username"]

        response = self.install(self.user_data_from_bitbucket)
        assert response.status_code == 200
        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)
        assert integration.name == self.user_display_name
        del integration.metadata["webhook_secret"]
        assert integration.metadata == self.user_metadata

    @mock.patch("sentry.integrations.bitbucket.integration.generate_token", return_value="0" * 64)
    def test_installed_with_secret(self, mock_generate_token: mock.MagicMock) -> None:
        response = self.install(self.team_data_from_bitbucket)
        assert mock_generate_token.called
        assert response.status_code == 200
        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)
        assert integration.name == self.username
        assert integration.metadata["webhook_secret"] == "0" * 64

    @responses.activate
    def test_installed_verifies_shared_secret(self) -> None:
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/workspaces/{self.team_data['uuid']}/hooks",
            json={},
        )

        response = self.client.post(self.path, data=self.team_data_from_bitbucket)

        assert response.status_code == 200
        assert Integration.objects.filter(
            provider=self.provider, external_id=self.client_key
        ).exists()
        request = responses.calls[0].request
        token = request.headers["Authorization"].removeprefix("JWT ")
        assert jwt.decode(token, self.shared_secret) == {
            "iss": "testserver.bitbucket",
            "iat": mock.ANY,
            "exp": mock.ANY,
            "qsh": get_query_hash(urlsplit(request.url).path, method="GET", query_params={}),
            "sub": self.client_key,
        }

    @mock.patch("sentry.integrations.bitbucket.installed.logger.warning")
    @responses.activate
    def test_installed_rejects_invalid_shared_secret(self, mock_warning: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/workspaces/{self.team_data['uuid']}/hooks",
            status=401,
        )

        response = self.client.post(self.path, data=self.team_data_from_bitbucket)

        assert response.status_code == 401
        assert not Integration.objects.filter(
            provider=self.provider, external_id=self.client_key
        ).exists()
        mock_warning.assert_called_once_with(
            "bitbucket.installed.invalid-credentials", extra={"status_code": 401}
        )

    @mock.patch("sentry.integrations.bitbucket.installed.BitbucketApiClient.get_workspace_hooks")
    def test_installed_rejects_invalid_workspace_uuid(
        self, mock_get_workspace_hooks: mock.MagicMock
    ) -> None:
        data = self.team_data_from_bitbucket.copy()
        data["principal"] = self.team_data.copy()
        data["principal"]["uuid"] = "../hook_events?ignored="

        response = self.client.post(self.path, data=data)

        assert response.status_code == 400
        mock_get_workspace_hooks.assert_not_called()
        assert not Integration.objects.filter(
            provider=self.provider, external_id=self.client_key
        ).exists()

    @responses.activate
    def test_plugin_migration(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            accessible_repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="sentryuser/repo",
                url="https://bitbucket.org/sentryuser/repo",
                provider="bitbucket",
                external_id="123456",
                config={"name": "sentryuser/repo"},
            )

            inaccessible_repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="otheruser/otherrepo",
                url="https://bitbucket.org/otheruser/otherrepo",
                provider="bitbucket",
                external_id="654321",
                config={"name": "otheruser/otherrepo"},
            )

        self.install(self.team_data_from_bitbucket)

        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)

        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/{accessible_repo.name}/hooks",
            json={"values": [{"description": "sentry-bitbucket-repo-hook"}]},
        )

        with self.tasks():
            with assume_test_silo_mode(SiloMode.CELL):
                org = serialize_rpc_organization(self.organization)
            BitbucketIntegrationProvider().post_install(
                integration=integration, organization=org, extra={}
            )

            with assume_test_silo_mode(SiloMode.CELL):
                assert (
                    Repository.objects.get(id=accessible_repo.id).integration_id == integration.id
                )

                assert (
                    Repository.objects.get(id=accessible_repo.id).provider
                    == "integrations:bitbucket"
                )

                assert Repository.objects.get(id=inaccessible_repo.id).integration_id is None
