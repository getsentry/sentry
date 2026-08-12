from __future__ import annotations

import pytest

from sentry.dynamic_sampling.cache import (
    SamplingCacheEntry,
    SamplingPipeline,
    get_all_project_sample_rates,
    get_all_transaction_sample_rates,
    get_organization_recalibration_factor,
    get_organization_sample_rate,
    get_project_recalibration_factor,
    get_project_sample_rate,
    get_transaction_sample_rates,
    mark_pipeline_executed,
    serving_pipeline,
    set_organization_recalibration_factor,
    set_organization_sample_rate,
    set_project_recalibration_factor,
    set_project_sample_rates,
    set_transaction_sample_rates,
)
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature

PER_ORG_SERVING = "organizations:dynamic-sampling-per-org-serving"


class SamplingCacheTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # The dynamic sampling Redis cluster is shared across parallel test workers, and the
        # legacy execution marker is a single global key.
        get_redis_client_for_ds().flushdb()


@pytest.mark.parametrize(
    "entry,expected_legacy,expected_per_org",
    [
        (
            SamplingCacheEntry.ORGANIZATION_SAMPLE_RATE,
            "ds::o:1:sliding_window_org_sample_rate",
            "ds::per_org:o:1:sliding_window_org_sample_rate",
        ),
        (
            SamplingCacheEntry.PROJECT_SAMPLE_RATES,
            "ds::o:1:prioritise_projects",
            "ds::per_org:o:1:prioritise_projects",
        ),
        (
            SamplingCacheEntry.TRANSACTION_SAMPLE_RATES,
            "ds::o:1:p:2:pri_tran",
            "ds::per_org:o:1:p:2:pri_tran",
        ),
        (
            SamplingCacheEntry.ORGANIZATION_RECALIBRATION_FACTOR,
            "ds::o:1:rate_rebalance_factor2",
            "ds::per_org:o:1:rate_rebalance_factor2",
        ),
        (
            SamplingCacheEntry.PROJECT_RECALIBRATION_FACTOR,
            "ds::p:2:rate_rebalance_factor2",
            "ds::per_org:p:2:rate_rebalance_factor2",
        ),
        (
            SamplingCacheEntry.PIPELINE_EXECUTED,
            "ds::sliding_window_org_executed",
            "ds::per_org:o:1:executed",
        ),
    ],
)
def test_key_structure(
    entry: SamplingCacheEntry, expected_legacy: str, expected_per_org: str
) -> None:
    assert entry.key(SamplingPipeline.LEGACY, org_id=1, project_id=2) == expected_legacy
    assert entry.key(SamplingPipeline.PER_ORG, org_id=1, project_id=2) == expected_per_org


class ServingPipelineTest(SamplingCacheTestCase):
    def test_defaults_to_the_legacy_pipeline(self) -> None:
        assert serving_pipeline(self.organization) is SamplingPipeline.LEGACY
        assert serving_pipeline(None) is SamplingPipeline.LEGACY

    @with_feature(PER_ORG_SERVING)
    def test_feature_flag_selects_the_per_org_pipeline(self) -> None:
        assert serving_pipeline(self.organization) is SamplingPipeline.PER_ORG


class OrganizationSampleRateTest(SamplingCacheTestCase):
    def test_round_trip(self) -> None:
        set_organization_sample_rate(SamplingPipeline.LEGACY, self.organization.id, 0.4)
        assert get_organization_sample_rate(self.organization) == 0.4

    def test_missing_value_is_none(self) -> None:
        assert get_organization_sample_rate(self.organization) is None

    @with_feature(PER_ORG_SERVING)
    def test_per_org_value_wins_over_legacy(self) -> None:
        set_organization_sample_rate(SamplingPipeline.LEGACY, self.organization.id, 0.4)
        set_organization_sample_rate(SamplingPipeline.PER_ORG, self.organization.id, 0.6)
        assert get_organization_sample_rate(self.organization) == 0.6

    @with_feature(PER_ORG_SERVING)
    def test_falls_back_to_legacy_when_per_org_is_missing(self) -> None:
        set_organization_sample_rate(SamplingPipeline.LEGACY, self.organization.id, 0.4)
        assert get_organization_sample_rate(self.organization) == 0.4


class ProjectSampleRatesTest(SamplingCacheTestCase):
    def test_round_trip_returns_the_replaced_rates(self) -> None:
        previous = set_project_sample_rates(
            SamplingPipeline.LEGACY,
            self.organization.id,
            [RebalancedItem(id=self.project.id, count=10, new_sample_rate=0.25)],
        )
        assert previous == {self.project.id: None}
        assert get_project_sample_rate(
            self.organization, self.project.id, error_sample_rate_fallback=0.9
        ) == (0.25, True)

        previous = set_project_sample_rates(
            SamplingPipeline.LEGACY,
            self.organization.id,
            [RebalancedItem(id=self.project.id, count=10, new_sample_rate=0.5)],
        )
        assert previous == {self.project.id: 0.25}

    def test_falls_back_when_the_pipeline_has_not_run(self) -> None:
        assert get_project_sample_rate(
            self.organization, self.project.id, error_sample_rate_fallback=0.9
        ) == (0.9, False)

    def test_missing_project_is_sampled_fully_once_the_pipeline_has_run(self) -> None:
        mark_pipeline_executed(SamplingPipeline.LEGACY)
        assert get_project_sample_rate(
            self.organization, self.project.id, error_sample_rate_fallback=0.9
        ) == (1.0, False)

    def test_get_all_reads_one_pipeline_only(self) -> None:
        set_project_sample_rates(
            SamplingPipeline.LEGACY,
            self.organization.id,
            [RebalancedItem(id=self.project.id, count=10, new_sample_rate=0.25)],
        )
        assert get_all_project_sample_rates(SamplingPipeline.LEGACY, self.organization.id) == {
            self.project.id: 0.25
        }
        assert get_all_project_sample_rates(SamplingPipeline.PER_ORG, self.organization.id) == {}

    @with_feature(PER_ORG_SERVING)
    def test_per_org_value_wins_over_legacy(self) -> None:
        set_project_sample_rates(
            SamplingPipeline.LEGACY,
            self.organization.id,
            [RebalancedItem(id=self.project.id, count=10, new_sample_rate=0.25)],
        )
        set_project_sample_rates(
            SamplingPipeline.PER_ORG,
            self.organization.id,
            [RebalancedItem(id=self.project.id, count=10, new_sample_rate=0.75)],
        )
        assert get_project_sample_rate(
            self.organization, self.project.id, error_sample_rate_fallback=0.9
        ) == (0.75, True)

    @with_feature(PER_ORG_SERVING)
    def test_falls_back_to_legacy_when_per_org_is_missing(self) -> None:
        set_project_sample_rates(
            SamplingPipeline.LEGACY,
            self.organization.id,
            [RebalancedItem(id=self.project.id, count=10, new_sample_rate=0.25)],
        )
        assert get_project_sample_rate(
            self.organization, self.project.id, error_sample_rate_fallback=0.9
        ) == (0.25, True)

    @with_feature(PER_ORG_SERVING)
    def test_per_org_execution_marker_is_per_organization(self) -> None:
        other = self.create_organization()
        mark_pipeline_executed(SamplingPipeline.PER_ORG, self.organization.id)

        assert get_project_sample_rate(
            self.organization, self.project.id, error_sample_rate_fallback=0.9
        ) == (1.0, False)
        assert get_project_sample_rate(other, self.project.id, error_sample_rate_fallback=0.9) == (
            0.9,
            False,
        )


class TransactionSampleRatesTest(SamplingCacheTestCase):
    def test_round_trip_without_key_clashes(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=self.organization)
        named_rates = [
            RebalancedItem(id="t1", count=1, new_sample_rate=0.6),
            RebalancedItem(id="t2", count=1, new_sample_rate=0.7),
        ]
        noise = [RebalancedItem(id="t11", count=1, new_sample_rate=0.1)]

        set_transaction_sample_rates(
            SamplingPipeline.LEGACY,
            org_id=self.organization.id,
            project_id=self.project.id,
            named_rates=named_rates,
            default_rate=0.3,
        )
        set_transaction_sample_rates(
            SamplingPipeline.LEGACY,
            org_id=other_org.id,
            project_id=self.project.id,
            named_rates=noise,
            default_rate=0.1,
        )
        set_transaction_sample_rates(
            SamplingPipeline.LEGACY,
            org_id=self.organization.id,
            project_id=other_project.id,
            named_rates=noise,
            default_rate=0.1,
        )

        assert get_transaction_sample_rates(self.organization, self.project.id, 1.0) == (
            {"t1": 0.6, "t2": 0.7},
            0.3,
        )

    def test_missing_value_returns_the_default_rate(self) -> None:
        assert get_transaction_sample_rates(self.organization, self.project.id, 0.33) == ({}, 0.33)

    def test_get_all_reports_a_miss_per_project(self) -> None:
        other_project = self.create_project(organization=self.organization)
        set_transaction_sample_rates(
            SamplingPipeline.LEGACY,
            org_id=self.organization.id,
            project_id=self.project.id,
            named_rates=[RebalancedItem(id="t1", count=1, new_sample_rate=0.6)],
            default_rate=0.3,
        )

        assert get_all_transaction_sample_rates(
            SamplingPipeline.LEGACY,
            self.organization.id,
            [self.project.id, other_project.id],
        ) == {self.project.id: ({"t1": 0.6}, 0.3), other_project.id: None}

    @with_feature(PER_ORG_SERVING)
    def test_per_org_value_wins_and_falls_back_to_legacy(self) -> None:
        set_transaction_sample_rates(
            SamplingPipeline.LEGACY,
            org_id=self.organization.id,
            project_id=self.project.id,
            named_rates=[RebalancedItem(id="t1", count=1, new_sample_rate=0.6)],
            default_rate=0.3,
        )
        assert get_transaction_sample_rates(self.organization, self.project.id, 1.0) == (
            {"t1": 0.6},
            0.3,
        )

        set_transaction_sample_rates(
            SamplingPipeline.PER_ORG,
            org_id=self.organization.id,
            project_id=self.project.id,
            named_rates=[RebalancedItem(id="t2", count=1, new_sample_rate=0.8)],
            default_rate=0.5,
        )
        assert get_transaction_sample_rates(self.organization, self.project.id, 1.0) == (
            {"t2": 0.8},
            0.5,
        )


class RecalibrationFactorTest(SamplingCacheTestCase):
    def test_round_trip(self) -> None:
        set_organization_recalibration_factor(SamplingPipeline.LEGACY, self.organization.id, 2.5)
        assert get_organization_recalibration_factor(self.organization) == 2.5

    def test_identity_factor_is_not_stored(self) -> None:
        set_organization_recalibration_factor(SamplingPipeline.LEGACY, self.organization.id, 2.5)
        set_organization_recalibration_factor(SamplingPipeline.LEGACY, self.organization.id, 1.0)

        cache_key = SamplingCacheEntry.ORGANIZATION_RECALIBRATION_FACTOR.key(
            SamplingPipeline.LEGACY, org_id=self.organization.id
        )
        assert get_redis_client_for_ds().get(cache_key) is None
        assert get_organization_recalibration_factor(self.organization) == 1.0

    @with_feature(PER_ORG_SERVING)
    def test_organization_factor_does_not_fall_back_to_legacy(self) -> None:
        set_organization_recalibration_factor(SamplingPipeline.LEGACY, self.organization.id, 2.5)
        assert get_organization_recalibration_factor(self.organization) == 1.0

        set_organization_recalibration_factor(SamplingPipeline.PER_ORG, self.organization.id, 3.5)
        assert get_organization_recalibration_factor(self.organization) == 3.5

    def test_project_factor_round_trip(self) -> None:
        set_project_recalibration_factor(SamplingPipeline.LEGACY, self.project.id, 0.5)
        assert get_project_recalibration_factor(self.organization, self.project.id) == 0.5

    @with_feature(PER_ORG_SERVING)
    def test_project_factor_is_the_identity_under_the_per_org_pipeline(self) -> None:
        set_project_recalibration_factor(SamplingPipeline.LEGACY, self.project.id, 0.5)
        assert get_project_recalibration_factor(self.organization, self.project.id) == 1.0
