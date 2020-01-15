from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from sentry.models import IdentityProvider, Identity, Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase
from sentry.integrations.example import ExampleIntegrationProvider, AliasedIntegrationProvider
from sentry.models import Repository
from sentry.plugins.base import plugins
from sentry.plugins.bases.issue2 import IssuePlugin2


class ExamplePlugin(IssuePlugin2):
    slug = "example"


plugins.register(ExamplePlugin)


def naive_build_integration(data):
    return data


@patch(
    "sentry.integrations.example.ExampleIntegrationProvider.build_integration",
    side_effect=naive_build_integration,
)
class FinishPipelineTestCase(IntegrationTestCase):
    provider = ExampleIntegrationProvider

    def setUp(self):
        super(FinishPipelineTestCase, self).setUp()
        self.external_id = "dummy_id-123"
        self.provider.needs_default_identity = False

    def tearDown(self):
        super(FinishPipelineTestCase, self).tearDown()

    def test_with_data(self, *args):
        data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
        }
        self.pipeline.state.data = data
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(
            provider=self.provider.key, external_id=self.external_id
        )
        assert integration.name == data["name"]
        assert integration.metadata == data["metadata"]
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration_id=integration.id
        ).exists()

    def test_aliased_integration_key(self, *args):
        self.provider = AliasedIntegrationProvider
        self.setUp()

        data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
        }
        self.pipeline.state.data = data
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)

        # Creates the Integration using ``integration_key`` instead of ``key``
        assert Integration.objects.filter(
            provider=self.provider.integration_key, external_id=self.external_id
        ).exists()

    def test_with_expect_exists(self, *args):
        old_integration = Integration.objects.create(
            provider=self.provider.key, external_id=self.external_id, name="Tester"
        )
        self.pipeline.state.data = {"expect_exists": True, "external_id": self.external_id}
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(
            provider=self.provider.key, external_id=self.external_id
        )
        assert integration.name == old_integration.name
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration_id=integration.id
        ).exists()

    def test_expect_exists_does_not_update(self, *args):
        old_integration = Integration.objects.create(
            provider=self.provider.key,
            external_id=self.external_id,
            name="Tester",
            metadata={"url": "https://example.com"},
        )
        self.pipeline.state.data = {
            "expect_exists": True,
            "external_id": self.external_id,
            "name": "Should Not Update",
            "metadata": {"url": "https://wrong.com"},
        }
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(
            provider=self.provider.key, external_id=self.external_id
        )
        assert integration.name == old_integration.name
        assert integration.metadata == old_integration.metadata
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration_id=integration.id
        ).exists()

    def test_with_default_id(self, *args):
        self.provider.needs_default_identity = True
        data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
            "user_identity": {
                "type": "plugin",
                "external_id": "AccountId",
                "scopes": [],
                "data": {
                    "access_token": "token12345",
                    "expires_in": "123456789",
                    "refresh_token": "refresh12345",
                    "token_type": "typetype",
                },
            },
        }
        self.pipeline.state.data = data
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(
            provider=self.provider.key, external_id=self.external_id
        )
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        assert org_integration.default_auth_id is not None
        assert Identity.objects.filter(id=org_integration.default_auth_id).exists()

    def test_default_identity_does_update(self, *args):
        self.provider.needs_default_identity = True
        old_identity_id = 234567
        integration = Integration.objects.create(
            provider=self.provider.key,
            external_id=self.external_id,
            metadata={"url": "https://example.com"},
        )
        OrganizationIntegration.objects.create(
            organization=self.organization, integration=integration, default_auth_id=old_identity_id
        )
        self.pipeline.state.data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
            "user_identity": {
                "type": "plugin",
                "external_id": "AccountId",
                "scopes": [],
                "data": {
                    "access_token": "token12345",
                    "expires_in": "123456789",
                    "refresh_token": "refresh12345",
                    "token_type": "typetype",
                },
            },
        }

        resp = self.pipeline.finish_pipeline()
        self.assertDialogSuccess(resp)

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        identity = Identity.objects.get(external_id="AccountId")
        assert org_integration.default_auth_id == identity.id

    def test_existing_identity_becomes_default_auth_on_new_orgintegration(self, *args):
        # The reinstall flow will result in an existing identity provider, identity
        # and integration records. Ensure that the new organizationintegration gets
        # a default_auth_id set.
        self.provider.needs_default_identity = True
        integration = Integration.objects.create(
            provider=self.provider.key,
            external_id=self.external_id,
            metadata={"url": "https://example.com"},
        )
        identity_provider = IdentityProvider.objects.create(
            external_id=self.external_id, type="plugin"
        )
        identity = Identity.objects.create(
            idp_id=identity_provider.id, external_id="AccountId", user_id=self.user.id
        )
        self.pipeline.state.data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
            "user_identity": {
                "type": "plugin",
                "external_id": "AccountId",
                "scopes": [],
                "data": {
                    "access_token": "token12345",
                    "expires_in": "123456789",
                    "refresh_token": "refresh12345",
                    "token_type": "typetype",
                },
            },
        }
        resp = self.pipeline.finish_pipeline()
        self.assertDialogSuccess(resp)

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        assert org_integration.default_auth_id == identity.id

    @patch("sentry.mediators.plugins.Migrator.call")
    def test_disabled_plugin_when_fully_migrated(self, call, *args):
        Repository.objects.create(
            organization_id=self.organization.id,
            name="user/repo",
            url="https://example.org/user/repo",
            provider=self.provider.key,
            external_id=self.external_id,
        )

        self.pipeline.state.data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
        }

        self.pipeline.finish_pipeline()

        assert call.called
