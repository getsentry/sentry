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
        org_identity = self.create_organization_identity(
            organization=self.organization,
            identity=self.identity,
        )
        with pytest.raises(IntegrityError):
            OrganizationIdentity.objects.create(
                organization_id=self.organization.id,
                identity=org_identity.identity,
            )

    def test_different_orgs_same_user_same_provider(self) -> None:
        org2 = self.create_organization(name="other-org", owner=self.user)
        self.create_organization_identity(
            organization=self.organization,
            identity=self.identity,
        )
        idp2 = self.create_identity_provider(type="datadog", external_id="dd-org-2")
        identity2 = self.create_identity(
            user=self.user,
            identity_provider=idp2,
            external_id="dd-user-456",
        )
        org_identity2 = self.create_organization_identity(
            organization=org2,
            identity=identity2,
        )
        assert org_identity2.organization_id == org2.id

    def test_multiple_identities_same_provider_same_org(self) -> None:
        self.create_organization_identity(
            organization=self.organization,
            identity=self.identity,
        )
        idp2 = self.create_identity_provider(type="datadog", external_id="dd-org-2")
        second_datadog_identity = self.create_identity(
            user=self.user,
            identity_provider=idp2,
            external_id="dd-user-456",
        )
        org_identity2 = self.create_organization_identity(
            organization=self.organization,
            identity=second_datadog_identity,
        )
        assert org_identity2.identity_id == second_datadog_identity.id
        assert (
            OrganizationIdentity.objects.filter(organization_id=self.organization.id).count() == 2
        )

    def test_cascade_on_identity_delete(self) -> None:
        self.create_organization_identity(
            organization=self.organization,
            identity=self.identity,
        )
        identity_id = self.identity.id
        assert OrganizationIdentity.objects.filter(identity_id=identity_id).exists()
        self.identity.delete()
        assert not OrganizationIdentity.objects.filter(identity_id=identity_id).exists()
