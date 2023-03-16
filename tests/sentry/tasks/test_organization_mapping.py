from datetime import datetime

import pytest

from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.tasks.organization_mapping import ORGANIZATION_MAPPING_EXPIRY, repair_mappings
from sentry.testutils import TestCase


class OrganizationMappingRepairTest(TestCase):
    def test_removes_expired_unverified(self):
        expired_time = datetime.now() - ORGANIZATION_MAPPING_EXPIRY
        mapping = self.create_organization_mapping(
            self.organization, verified=False, date_created=expired_time
        )
        phantom_mapping = self.create_organization_mapping(
            Organization(id=123, slug="fake-slug"), date_created=expired_time, verified=False
        )

        repair_mappings()

        with pytest.raises(OrganizationMapping.DoesNotExist):
            phantom_mapping.refresh_from_db()
        mapping.refresh_from_db()
        assert mapping.verified

    def test_removes_expired_duplicates(self):
        expired_time = datetime.now() - ORGANIZATION_MAPPING_EXPIRY
        mapping = self.create_organization_mapping(
            self.organization, verified=False, date_created=expired_time
        )
        old_mapping = self.create_organization_mapping(
            self.organization,
            verified=True,
            slug="old_slug_name",
            date_created=expired_time,
        )

        repair_mappings()

        with pytest.raises(OrganizationMapping.DoesNotExist):
            old_mapping.refresh_from_db()

        mapping.refresh_from_db()
        assert mapping.verified

    def test_set_verified(self):
        expired_time = datetime.now() - ORGANIZATION_MAPPING_EXPIRY
        mapping = self.create_organization_mapping(
            self.organization, verified=False, date_created=expired_time, idempotency_key="1234"
        )

        repair_mappings()

        mapping.refresh_from_db()
        assert mapping.verified is True
        assert mapping.idempotency_key == ""
