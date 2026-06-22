import pytest
from django.db import IntegrityError

from sentry.identity import register
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import OrganizationIdentity


@control_silo_test
class IdentityTestCase(TestCase):
    def test_get_provider(self) -> None:
        integration = self.create_integration(
            organization=self.organization, provider="dummy", external_id="tester_id"
        )
        provider_model = self.create_identity_provider(integration=integration)
        register(DummyProvider)
        identity_model = self.create_identity(
            user=self.user, identity_provider=provider_model, external_id="identity_id"
        )

        provider = identity_model.get_provider()
        assert provider.name == "Dummy"
        assert provider.key == "dummy"


@control_silo_test
class OrganizationIdentityTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.idp = self.create_identity_provider(type="datadog", external_id="dd-org-1")
        self.identity = self.create_identity(
            user=self.user,
            identity_provider=self.idp,
            external_id="dd-user-123",
            data={"access_token": "dd-token"},
        )

    def test_unique_constraint(self) -> None:
        self.create_organization_identity(
            organization=self.organization,
            user=self.user,
            identity=self.identity,
            provider_key="datadog",
        )
        idp2 = self.create_identity_provider(type="datadog", external_id="dd-org-2")
        identity2 = self.create_identity(
            user=self.user,
            identity_provider=idp2,
            external_id="dd-user-456",
        )
        with pytest.raises(IntegrityError):
            OrganizationIdentity.objects.create(
                organization_id=self.organization.id,
                user_id=self.user.id,
                identity=identity2,
                provider_key="datadog",
            )

    def test_different_orgs_same_user_same_provider(self) -> None:
        org2 = self.create_organization(name="other-org", owner=self.user)
        self.create_organization_identity(
            organization=self.organization,
            user=self.user,
            identity=self.identity,
            provider_key="datadog",
        )
        idp2 = self.create_identity_provider(type="datadog", external_id="dd-org-2")
        identity2 = self.create_identity(
            user=self.user,
            identity_provider=idp2,
            external_id="dd-user-456",
        )
        org_identity2 = self.create_organization_identity(
            organization=org2,
            user=self.user,
            identity=identity2,
            provider_key="datadog",
        )
        assert org_identity2.organization_id == org2.id

    def test_different_providers_same_org(self) -> None:
        gcp_idp = self.create_identity_provider(type="gcp", external_id="gcp-project-1")
        gcp_identity = self.create_identity(
            user=self.user,
            identity_provider=gcp_idp,
            external_id="gcp-user-123",
        )
        self.create_organization_identity(
            organization=self.organization,
            user=self.user,
            identity=self.identity,
            provider_key="datadog",
        )
        org_identity2 = self.create_organization_identity(
            organization=self.organization,
            user=self.user,
            identity=gcp_identity,
            provider_key="gcp",
        )
        assert org_identity2.provider_key == "gcp"
        assert (
            OrganizationIdentity.objects.filter(
                organization_id=self.organization.id, user_id=self.user.id
            ).count()
            == 2
        )

    def test_cascade_on_identity_delete(self) -> None:
        self.create_organization_identity(
            organization=self.organization,
            user=self.user,
            identity=self.identity,
            provider_key="datadog",
        )
        identity_id = self.identity.id
        assert OrganizationIdentity.objects.filter(identity_id=identity_id).exists()
        self.identity.delete()
        assert not OrganizationIdentity.objects.filter(identity_id=identity_id).exists()
