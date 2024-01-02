from __future__ import annotations

from typing import Any

import responses

from sentry.integrations.bitbucket.installed import BitbucketInstalledEndpoint
from sentry.integrations.bitbucket.integration import BitbucketIntegrationProvider, scopes
from sentry.models.integrations.integration import Integration
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.plugins.base import plugins
from sentry.plugins.bases.issue2 import IssueTrackingPlugin2
from sentry.services.hybrid_cloud.organization.serial import serialize_rpc_organization
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class BitbucketPlugin(IssueTrackingPlugin2):
    slug = "bitbucket"
    name = "Bitbucket Mock Plugin"
    conf_key = slug


@control_silo_test
class BitbucketInstalledEndpointTest(APITestCase):
    def setUp(self):
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
            "uuid": "{e123-f456-g78910}",
        }
        self.user_data = self.team_data.copy()
        self.user_data["type"] = "user"

        self.user_data["display_name"] = self.user_display_name

        self.metadata = {
            "public_key": self.public_key,
            "shared_secret": self.shared_secret,
            "base_url": self.base_api_url,
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

        plugins.register(BitbucketPlugin)

    def tearDown(self):
        plugins.unregister(BitbucketPlugin)
        super().tearDown()

    def test_default_permissions(self):
        # Permissions must be empty so that it will be accessible to bitbucket.
        assert BitbucketInstalledEndpoint.authentication_classes == ()
        assert BitbucketInstalledEndpoint.permission_classes == ()

    def test_installed_with_public_key(self):
        response = self.client.post(self.path, data=self.team_data_from_bitbucket)
        assert response.status_code == 200
        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)
        assert integration.name == self.username
        assert integration.metadata == self.metadata

    def test_installed_without_public_key(self):
        integration, created = Integration.objects.get_or_create(
            provider=self.provider,
            external_id=self.client_key,
            defaults={"name": self.user_display_name, "metadata": self.user_metadata},
        )
        del self.user_data_from_bitbucket["principal"]["username"]
        response = self.client.post(self.path, data=self.user_data_from_bitbucket)
        assert response.status_code == 200

        # assert no changes have been made to the integration
        integration_after = Integration.objects.get(
            provider=self.provider, external_id=self.client_key
        )
        assert integration.name == integration_after.name
        assert integration.metadata == integration_after.metadata

    def test_installed_without_username(self):
        """Test a user (not team) installation where the user has hidden their username from public view"""

        # Remove username to simulate privacy mode
        del self.user_data_from_bitbucket["principal"]["username"]

        response = self.client.post(self.path, data=self.user_data_from_bitbucket)
        assert response.status_code == 200
        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)
        assert integration.name == self.user_display_name
        assert integration.metadata == self.user_metadata

    @responses.activate
    def test_plugin_migration(self):
        with assume_test_silo_mode(SiloMode.REGION):
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

        self.client.post(self.path, data=self.team_data_from_bitbucket)

        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)

        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/{accessible_repo.name}/hooks",
            json={"values": [{"description": "sentry-bitbucket-repo-hook"}]},
        )

        with self.tasks():
            with assume_test_silo_mode(SiloMode.REGION):
                org = serialize_rpc_organization(self.organization)
            BitbucketIntegrationProvider().post_install(
                integration=integration,
                organization=org,
            )

            with assume_test_silo_mode(SiloMode.REGION):
                assert (
                    Repository.objects.get(id=accessible_repo.id).integration_id == integration.id
                )

                assert (
                    Repository.objects.get(id=accessible_repo.id).provider
                    == "integrations:bitbucket"
                )

                assert Repository.objects.get(id=inaccessible_repo.id).integration_id is None

    @responses.activate
    def test_disable_plugin_when_fully_migrated(self):
        with assume_test_silo_mode(SiloMode.REGION):
            project = Project.objects.create(organization_id=self.organization.id)

            plugin = plugins.get("bitbucket")
            plugin.enable(project)

            # Accessible to new Integration
            Repository.objects.create(
                organization_id=self.organization.id,
                name="sentryuser/repo",
                url="https://bitbucket.org/sentryuser/repo",
                provider="bitbucket",
                external_id="123456",
                config={"name": "sentryuser/repo"},
            )

        self.client.post(self.path, data=self.team_data_from_bitbucket)

        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)

        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser/repo/hooks",
            json={"values": [{"description": "sentry-bitbucket-repo-hook"}]},
        )

        assert "bitbucket" in [p.slug for p in plugins.for_project(project)]

        with self.tasks():
            with assume_test_silo_mode(SiloMode.REGION):
                org = serialize_rpc_organization(self.organization)
            BitbucketIntegrationProvider().post_install(integration=integration, organization=org)

            assert "bitbucket" not in [p.slug for p in plugins.for_project(project)]
