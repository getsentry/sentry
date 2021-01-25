import responses

from sentry.testutils import APITestCase
from sentry.integrations.bitbucket.installed import BitbucketInstalledEndpoint
from sentry.integrations.bitbucket.integration import scopes, BitbucketIntegrationProvider
from sentry.models import Integration, Repository, Project
from sentry.plugins.base import plugins
from tests.sentry.plugins.testutils import register_mock_plugins, unregister_mock_plugins


class BitbucketInstalledEndpointTest(APITestCase):
    def setUp(self):
        self.provider = "bitbucket"
        self.path = "/extensions/bitbucket/installed/"

        self.username = "sentryuser"
        self.client_key = "connection:123"
        self.public_key = "123abcDEFg"
        self.shared_secret = "G12332434SDfsjkdfgsd"
        self.base_url = "https://api.bitbucket.org"
        self.domain_name = "bitbucket.org/sentryuser"
        self.display_name = "Sentry User"
        self.icon = "https://bitbucket.org/account/sentryuser/avatar/32/"

        self.user_data = {
            "username": self.username,
            "display_name": self.display_name,
            "account_id": "123456t256371u",
            "links": {
                "self": {"herf": "https://api.bitbucket.org/2.0/users/sentryuser/"},
                "html": {"href": "https://bitbucket.org/sentryuser/"},
                "avatar": {"href": "https://bitbucket.org/account/sentryuser/avatar/32/"},
            },
            "created_on": "2018-04-18T00:46:37.374621+00:00",
            "is_staff": False,
            "type": "user",
            "uuid": "{e123-f456-g78910}",
        }
        self.metadata = {
            "public_key": self.public_key,
            "shared_secret": self.shared_secret,
            "base_url": self.base_url,
            "domain_name": self.domain_name,
            "icon": self.icon,
            "scopes": list(scopes),
            "type": self.user_data["type"],
            "uuid": self.user_data["uuid"],
        }

        self.data_from_bitbucket = {
            "key": "sentry-bitbucket",
            "eventType": "installed",
            "baseUrl": self.base_url,
            "sharedSecret": self.shared_secret,
            "publicKey": self.public_key,
            "user": self.user_data,
            "productType": "bitbucket",
            "baseApiUrl": "https://api.bitbucket.org",
            "clientKey": self.client_key,
            "principal": self.user_data,
        }
        self.data_without_public_key = {"identity": {"bitbucket_client_id": self.client_key}}

        register_mock_plugins()

    def tearDown(self):
        unregister_mock_plugins()
        super(BitbucketInstalledEndpointTest, self).tearDown()

    def test_default_permissions(self):
        # Permissions must be empty so that it will be accessible to bitbucket.
        assert BitbucketInstalledEndpoint.authentication_classes == ()
        assert BitbucketInstalledEndpoint.permission_classes == ()

    def test_installed_with_public_key(self):
        response = self.client.post(self.path, data=self.data_from_bitbucket)
        assert response.status_code == 200
        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)
        assert integration.name == self.username
        assert integration.metadata == self.metadata

    def test_installed_without_username(self):
        # Remove username to simulate privacy mode.
        del self.data_from_bitbucket["principal"]["username"]

        response = self.client.post(self.path, data=self.data_from_bitbucket)
        assert response.status_code == 200
        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)
        assert integration.name == self.user_data["uuid"]
        assert integration.metadata == self.metadata

    @responses.activate
    def test_plugin_migration(self):
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

        self.client.post(self.path, data=self.data_from_bitbucket)

        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)

        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/{}/hooks".format(accessible_repo.name),
            json={"values": [{"description": "sentry-bitbucket-repo-hook"}]},
        )

        with self.tasks():
            BitbucketIntegrationProvider().post_install(integration, self.organization)

            assert Repository.objects.get(id=accessible_repo.id).integration_id == integration.id

            assert (
                Repository.objects.get(id=accessible_repo.id).provider == "integrations:bitbucket"
            )

            assert Repository.objects.get(id=inaccessible_repo.id).integration_id is None

    @responses.activate
    def test_disable_plugin_when_fully_migrated(self):
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

        self.client.post(self.path, data=self.data_from_bitbucket)

        integration = Integration.objects.get(provider=self.provider, external_id=self.client_key)

        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser/repo/hooks",
            json={"values": [{"description": "sentry-bitbucket-repo-hook"}]},
        )

        assert "bitbucket" in [p.slug for p in plugins.for_project(project)]

        with self.tasks():
            BitbucketIntegrationProvider().post_install(integration, self.organization)

            assert "bitbucket" not in [p.slug for p in plugins.for_project(project)]

    def test_installed_without_public_key(self):
        integration = Integration.objects.get_or_create(
            provider=self.provider,
            external_id=self.client_key,
            defaults={"name": self.username, "metadata": self.metadata},
        )[0]

        response = self.client.post(self.path, data=self.data_from_bitbucket)
        assert response.status_code == 200

        # assert no changes have been made to the integration
        integration_after = Integration.objects.get(
            provider=self.provider, external_id=self.client_key
        )
        assert integration.name == integration_after.name
        assert integration.metadata == integration_after.metadata
