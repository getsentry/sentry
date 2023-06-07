from datetime import datetime

import pytest

from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.tasks.organization_mapping import ORGANIZATION_MAPPING_EXPIRY, repair_mappings
from sentry.testutils import TestCase
from sentry.testutils.factories import Factories


class OrganizationMappingRepairTest(TestCase):
    def test_removes_expired_unverified(self):
        self.organization = Factories.create_organization()
        expired_time = datetime.now() - ORGANIZATION_MAPPING_EXPIRY
        mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        mapping.verified = False
        mapping.date_created = expired_time
        mapping.save()
        phantom_mapping = self.create_organization_mapping(
            Organization(id=123, slug="fake-slug"), date_created=expired_time, verified=False
        )

        repair_mappings()

        with pytest.raises(OrganizationMapping.DoesNotExist):
            phantom_mapping.refresh_from_db()
        mapping.refresh_from_db()
        assert mapping.verified

    def test_set_verified(self):
        self.organization = Factories.create_organization()
        expired_time = datetime.now() - ORGANIZATION_MAPPING_EXPIRY

        mapping = OrganizationMapping.objects.get(organization_id=self.organization.id)
        mapping.verified = False
        mapping.date_created = expired_time
        mapping.idempotency_key = "1234"
        mapping.save()

        repair_mappings()

        mapping.refresh_from_db()
        assert mapping.verified is True
        assert mapping.idempotency_key == ""
