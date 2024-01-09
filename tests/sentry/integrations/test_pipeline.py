from unittest.mock import patch

from django.db import router

from sentry.api.utils import generate_organization_url
from sentry.integrations.example import AliasedIntegrationProvider, ExampleIntegrationProvider
from sentry.integrations.gitlab.integration import GitlabIntegrationProvider
from sentry.models.identity import Identity, IdentityProvider
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.repository import Repository
from sentry.plugins.base import plugins
from sentry.plugins.bases.issue2 import IssuePlugin2
from sentry.signals import receivers_raise_on_send
from sentry.silo import SiloMode, unguarded_write
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class ExamplePlugin(IssuePlugin2):
    slug = "example"


plugins.register(ExamplePlugin)


def naive_build_integration(data):
    return data


@control_silo_test
@patch(
    "sentry.integrations.example.ExampleIntegrationProvider.build_integration",
    side_effect=naive_build_integration,
)
class FinishPipelineTestCase(IntegrationTestCase):
    provider = ExampleIntegrationProvider

    def setUp(self):
        super().setUp()
        self.external_id = "dummy_id-123"
        self.provider.needs_default_identity = False
        self.provider.is_region_restricted = False

    def tearDown(self):
        super().tearDown()

    def _setup_region_restriction(self):
        self.provider.is_region_restricted = True
        na_orgs = [
            self.create_organization(name="na_org"),
            self.create_organization(name="na_org_2"),
        ]
        integration = Integration.objects.create(
            name="test", external_id=self.external_id, provider=self.provider.key
        )
        with receivers_raise_on_send(), outbox_runner(), unguarded_write(
            using=router.db_for_write(OrganizationMapping)
        ):
            for org in na_orgs:
                integration.add_organization(org)
                mapping = OrganizationMapping.objects.get(organization_id=org.id)
                mapping.update(region_name="na")

    def test_with_data(self, *args):
        data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
        }
        self.pipeline.state.data = data
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)
        assert b"document.origin);" in resp.content

        integration = Integration.objects.get(
            provider=self.provider.key, external_id=self.external_id
        )
        assert integration.name == data["name"]
        assert integration.metadata == data["metadata"]
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration_id=integration.id
        ).exists()

    def test_with_customer_domain(self, *args):
        with self.feature({"organizations:customer-domains": [self.organization.slug]}):
            data = {
                "external_id": self.external_id,
                "name": "Name",
                "metadata": {"url": "https://example.com"},
            }
            self.pipeline.state.data = data
            resp = self.pipeline.finish_pipeline()

            self.assertDialogSuccess(resp)
            assert (
                f', "{generate_organization_url(self.organization.slug)}");'.encode()
                in resp.content
            )

            integration = Integration.objects.get(
                provider=self.provider.key, external_id=self.external_id
            )
            assert integration.name == data["name"]
            assert integration.metadata == data["metadata"]
            assert OrganizationIntegration.objects.filter(
                organization_id=self.organization.id, integration_id=integration.id
            ).exists()

    @patch("sentry.signals.integration_added.send_robust")
    def test_provider_should_check_region_violation(self, *args):
        """Ensures we validate regions if `provider.is_region_restricted` is set to True"""
        self.provider.is_region_restricted = True
        self.pipeline.state.data = {"external_id": self.external_id}
        with patch(
            "sentry.integrations.pipeline.is_violating_region_restriction"
        ) as mock_check_violation:
            self.pipeline.finish_pipeline()
            assert mock_check_violation.called

    @patch("sentry.signals.integration_added.send_robust")
    def test_provider_should_not_check_region_violation(self, *args):
        """Ensures we don't reject regions if `provider.is_region_restricted` is set to False"""
        self.pipeline.state.data = {"external_id": self.external_id}
        with patch(
            "sentry.integrations.pipeline.is_violating_region_restriction"
        ) as mock_check_violation:
            self.pipeline.finish_pipeline()
            assert not mock_check_violation.called

    @patch("sentry.signals.integration_added.send_robust")
    def test_is_violating_region_restriction_success(self, *args):
        """Ensures pipeline can complete if all integration organizations reside in one region."""
        self._setup_region_restriction()

        # Installing organization is from the same region
        mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)

        with unguarded_write(using=router.db_for_write(OrganizationMapping)):
            mapping.update(region_name="na")

        self.pipeline.state.data = {"external_id": self.external_id}
        with patch("sentry.integrations.pipeline.IntegrationPipeline._dialog_response") as resp:
            self.pipeline.finish_pipeline()
            _data, success = resp.call_args[0]
            assert success

    @patch("sentry.signals.integration_added.send_robust")
    def test_is_violating_region_restriction_failure(self, *args):
        """Ensures pipeline can produces an error if all integration organizations do not reside in one region."""
        self._setup_region_restriction()

        # Installing organization is from a different region
        mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)

        with unguarded_write(using=router.db_for_write(OrganizationMapping)):
            mapping.update(region_name="eu")

        self.pipeline.state.data = {"external_id": self.external_id}
        with patch("sentry.integrations.pipeline.IntegrationPipeline._dialog_response") as resp:
            self.pipeline.finish_pipeline()
            data, success = resp.call_args[0]
            if SiloMode.get_current_mode() == SiloMode.MONOLITH:
                assert success
            if SiloMode.get_current_mode() == SiloMode.CONTROL:
                assert not success
                assert "resides in a different region" in str(data)

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
            organization_id=self.organization.id,
            integration=integration,
            default_auth_id=old_identity_id,
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

    def test_new_external_id_same_user(self, *args):
        # we need to make sure any other org_integrations have the same
        # identity that we use for the new one
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
        org2 = self.create_organization(owner=self.user)
        integration.add_organization(org2, default_auth_id=identity.id)
        self.pipeline.state.data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
            "user_identity": {
                "type": "plugin",
                "external_id": "new_external_id",
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

        org_integrations = OrganizationIntegration.objects.filter(integration_id=integration.id)
        identity = Identity.objects.get(idp_id=identity_provider.id, external_id="new_external_id")
        for org_integration in org_integrations:
            assert org_integration.default_auth_id == identity.id

    def test_different_user_same_external_id_no_default_needed(self, *args):
        new_user = self.create_user()
        integration = Integration.objects.create(
            provider=self.provider.key,
            external_id=self.external_id,
            metadata={"url": "https://example.com"},
        )
        identity_provider = IdentityProvider.objects.create(
            external_id=self.external_id, type=self.provider.key
        )
        Identity.objects.create(
            idp_id=identity_provider.id, external_id="AccountId", user_id=new_user.id
        )
        self.pipeline.state.data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
            "user_identity": {
                "type": self.provider.key,
                "external_id": "AccountId",
                "scopes": [],
                "data": {},
            },
        }
        resp = self.pipeline.finish_pipeline()
        self.assertDialogSuccess(resp)
        assert OrganizationIntegration.objects.filter(
            integration_id=integration.id, organization_id=self.organization.id
        ).exists()

    @patch("sentry.mediators.plugins.Migrator.call")
    def test_disabled_plugin_when_fully_migrated(self, call, *args):
        with assume_test_silo_mode(SiloMode.REGION):
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


@control_silo_test
@patch(
    "sentry.integrations.gitlab.GitlabIntegrationProvider.build_integration",
    side_effect=naive_build_integration,
)
class GitlabFinishPipelineTest(IntegrationTestCase):
    provider = GitlabIntegrationProvider

    def setUp(self):
        super().setUp()
        self.external_id = "dummy_id-123"

    def tearDown(self):
        super().tearDown()

    def test_different_user_same_external_id(self, *args):
        new_user = self.create_user()
        self.setUp()
        integration = Integration.objects.create(
            provider=self.provider.key,
            external_id=self.external_id,
            metadata={"url": "https://example.com"},
        )
        identity_provider = IdentityProvider.objects.create(
            external_id=self.external_id, type=self.provider.key
        )
        Identity.objects.create(
            idp_id=identity_provider.id, external_id="AccountId", user_id=new_user.id
        )
        self.pipeline.state.data = {
            "external_id": self.external_id,
            "name": "Name",
            "metadata": {"url": "https://example.com"},
            "user_identity": {
                "type": self.provider.key,
                "external_id": "AccountId",
                "scopes": [],
                "data": {},
            },
        }
        resp = self.pipeline.finish_pipeline()
        assert not OrganizationIntegration.objects.filter(integration_id=integration.id)
        assert "account is linked to a different Sentry user" in str(resp.content)
