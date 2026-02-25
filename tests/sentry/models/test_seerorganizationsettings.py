import pytest
from django.db import IntegrityError

from sentry.models.seerorganizationsettings import SeerOrganizationSettings
from sentry.testutils.cases import TestCase


class SeerOrganizationSettingsTest(TestCase):
    def test_create_with_defaults(self):
        settings = SeerOrganizationSettings.objects.create(
            organization=self.organization,
        )
        assert settings.organization_id == self.organization.id
        assert settings.default_coding_agent_integration_id is None
        assert settings.date_added is not None
        assert settings.date_updated is not None

    def test_create_with_integration(self):
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="12345",
        )
        settings = SeerOrganizationSettings.objects.create(
            organization=self.organization,
            default_coding_agent_integration_id=integration.id,
        )
        assert settings.default_coding_agent_integration_id == integration.id

    def test_unique_constraint_on_organization(self):
        SeerOrganizationSettings.objects.create(organization=self.organization)
        with pytest.raises(IntegrityError):
            SeerOrganizationSettings.objects.create(organization=self.organization)

    def test_cascade_delete_on_organization(self):
        SeerOrganizationSettings.objects.create(organization=self.organization)
        assert SeerOrganizationSettings.objects.filter(organization=self.organization).exists()

        org_id = self.organization.id
        self.organization.delete()
        assert not SeerOrganizationSettings.objects.filter(organization_id=org_id).exists()
