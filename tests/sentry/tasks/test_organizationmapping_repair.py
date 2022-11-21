from datetime import datetime
from typing import Tuple

import pytest

from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.tasks.organizationmapping import ORGANIZATION_MAPPING_EXPIRY, organizationmapping_repair
from sentry.testutils import TestCase
from sentry.testutils.factories import Factories


class OrganizationMappingRepairTest(TestCase):
    def create_org_with_mapping(self, **kwargs) -> Tuple[Organization, OrganizationMapping]:
        org = Factories.create_organization()
        mapping = Factories.create_organization_mapping(org, **kwargs)
        return (org, mapping)

    def test_removes_expired_unverified(self):
        expired_time = datetime.now() - ORGANIZATION_MAPPING_EXPIRY
        _, mapping = self.create_org_with_mapping(verified=False, created=expired_time)
        zombie_mapping = Factories.create_organization_mapping(
            Organization(id=123, slug="fakeslug"), created=expired_time, verified=False
        )
        organizationmapping_repair()
        with pytest.raises(OrganizationMapping.DoesNotExist):
            zombie_mapping.refresh_from_db()
        mapping.refresh_from_db()
        assert mapping.verified

    def test_removes_expired_duplicates(self):
        expired_time = datetime.now() - ORGANIZATION_MAPPING_EXPIRY
        org, mapping = self.create_org_with_mapping(verified=False, created=expired_time)
        oldmapping = Factories.create_organization_mapping(
            org,
            verified=True,
            slug="old_slug_name",
            created=expired_time,
        )
        organizationmapping_repair()
        with pytest.raises(OrganizationMapping.DoesNotExist):
            oldmapping.refresh_from_db()
        mapping.refresh_from_db()
        assert mapping.verified

    def test_valid_verifies(self):
        expired_time = datetime.now() - ORGANIZATION_MAPPING_EXPIRY
        org, mapping = self.create_org_with_mapping(verified=False, created=expired_time)
        organizationmapping_repair()
        mapping.refresh_from_db()
        assert mapping.verified
