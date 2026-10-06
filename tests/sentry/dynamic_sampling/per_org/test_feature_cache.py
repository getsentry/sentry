from unittest.mock import patch

import orjson
import pytest

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.per_org.feature_cache import (
    ORGS_WITH_DYNAMIC_SAMPLING_CACHE_KEY,
    cache_dynamic_sampling_feature_flags,
    candidate_organizations,
    get_orgs_with_dynamic_sampling,
)
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import TestCase

FEATURE = "organizations:dynamic-sampling"


class FeatureCacheTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        get_redis_client_for_ds().delete(ORGS_WITH_DYNAMIC_SAMPLING_CACHE_KEY)

    def _org_with_project(self):
        org = self.create_organization()
        self.create_project(organization=org)
        return org

    def test_candidate_organizations_needs_an_active_org_and_project(self) -> None:
        with_project = self._org_with_project()
        without_projects = self.create_organization()

        inactive_org = self._org_with_project()
        inactive_org.status = OrganizationStatus.PENDING_DELETION
        inactive_org.save()

        with_inactive_project = self.create_organization()
        project = self.create_project(organization=with_inactive_project)
        project.status = ObjectStatus.PENDING_DELETION
        project.save()

        org_ids = set(candidate_organizations().values_list("id", flat=True))

        assert with_project.id in org_ids
        assert without_projects.id not in org_ids
        assert inactive_org.id not in org_ids
        assert with_inactive_project.id not in org_ids

    def test_refresh_caches_only_orgs_with_the_feature(self) -> None:
        with_feature = self._org_with_project()
        without_feature = self._org_with_project()

        with self.feature({FEATURE: [with_feature.slug]}):
            assert cache_dynamic_sampling_feature_flags() == 1

        assert get_orgs_with_dynamic_sampling() == [with_feature.id]
        assert without_feature.id not in (get_orgs_with_dynamic_sampling() or [])

    def test_refresh_sets_the_ttl(self) -> None:
        org = self._org_with_project()

        with self.feature({FEATURE: [org.slug]}):
            cache_dynamic_sampling_feature_flags()

        ttl = get_redis_client_for_ds().ttl(ORGS_WITH_DYNAMIC_SAMPLING_CACHE_KEY)
        assert 0 < ttl <= 24 * 60 * 60

    def test_an_empty_refresh_keeps_the_previous_entry(self) -> None:
        org = self._org_with_project()
        with self.feature({FEATURE: [org.slug]}):
            cache_dynamic_sampling_feature_flags()

        with self.feature({FEATURE: []}):
            assert cache_dynamic_sampling_feature_flags() == 0

        assert get_orgs_with_dynamic_sampling() == [org.id]

    def test_refresh_raises_when_the_feature_cannot_be_evaluated(self) -> None:
        self._org_with_project()

        with (
            patch("sentry.features.batch_has_for_organizations", return_value=None),
            pytest.raises(RuntimeError),
        ):
            cache_dynamic_sampling_feature_flags()

    def test_a_missing_entry_reads_as_unknown(self) -> None:
        assert get_orgs_with_dynamic_sampling() is None

    def test_unreadable_entry_reads_as_unknown(self) -> None:
        get_redis_client_for_ds().set(ORGS_WITH_DYNAMIC_SAMPLING_CACHE_KEY, "not json")

        assert get_orgs_with_dynamic_sampling() is None

    def test_reads_back_what_the_refresh_wrote(self) -> None:
        get_redis_client_for_ds().set(
            ORGS_WITH_DYNAMIC_SAMPLING_CACHE_KEY, orjson.dumps([11, 22, 33])
        )

        assert get_orgs_with_dynamic_sampling() == [11, 22, 33]
