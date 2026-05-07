from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from sentry.dynamic_sampling.per_org.tasks.configuration import (
    BaseDynamicSamplingConfiguration,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.tasks.queries import (
    EAPProjectTransactionVolumes,
    get_eap_organization_volume,
    get_eap_transaction_volumes,
    run_batched_spans_table_query,
)
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.models.organization import Organization
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class BatchedSpansTableQueryTest(TestCase):
    def test_iterates_query_data_in_offset_batches(self) -> None:
        calls: list[tuple[int, int]] = []
        query = {"query_string": "is_transaction:true"}

        def run_table_query(**kwargs):
            calls.append((kwargs["offset"], kwargs["limit"]))
            assert kwargs["query_string"] == "is_transaction:true"

            if kwargs["offset"] == 0:
                return {"data": [{"transaction": "a"}, {"transaction": "b"}]}
            return {"data": [{"transaction": "c"}]}

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.queries.Spans.run_table_query",
            side_effect=run_table_query,
        ):
            batches = list(run_batched_spans_table_query(query, 2))

        assert batches == [
            [{"transaction": "a"}, {"transaction": "b"}],
            [{"transaction": "c"}],
        ]
        assert calls == [(0, 2), (2, 2)]


class EAPOrganizationVolumeTest(TestCase, SnubaTestCase, SpanTestCase):
    def get_config(self, organization: Organization) -> BaseDynamicSamplingConfiguration:
        with patch(
            "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
            return_value=1.0,
        ):
            return get_configuration(organization.id)

    def test_get_eap_organization_volume_existing_org(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        other_organization = self.create_organization()
        other_project = self.create_project(organization=other_organization)
        timestamp = before_now(minutes=15)

        self.store_spans(
            [
                self.create_span(
                    {"is_segment": True},
                    organization=organization,
                    project=project,
                    start_ts=timestamp,
                ),
                self.create_span(
                    {"is_segment": True},
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=1),
                ),
                self.create_span(
                    {"is_segment": False},
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=2),
                ),
                self.create_span(
                    {"is_segment": True},
                    organization=other_organization,
                    project=other_project,
                    start_ts=timestamp,
                ),
            ]
        )

        org_volume = get_eap_organization_volume(
            self.get_config(organization), time_interval=timedelta(hours=1)
        )

        assert org_volume == OrganizationDataVolume(org_id=organization.id, total=2, indexed=2)

    def test_get_eap_organization_volume_returns_raw_and_extrapolated_counts(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        timestamp = before_now(minutes=15)

        self.store_spans(
            [
                self.create_span(
                    {
                        "is_segment": True,
                        "measurements": {"server_sample_rate": {"value": 0.1}},
                    },
                    organization=organization,
                    project=project,
                    start_ts=timestamp,
                ),
            ]
        )

        org_volume = get_eap_organization_volume(
            self.get_config(organization), time_interval=timedelta(hours=1)
        )

        assert org_volume == OrganizationDataVolume(org_id=organization.id, total=10, indexed=1)

    def test_get_eap_organization_volume_without_traffic(self) -> None:
        organization = self.create_organization()
        self.create_project(organization=organization)

        org_volume = get_eap_organization_volume(
            self.get_config(organization), time_interval=timedelta(hours=1)
        )

        assert org_volume is None

    def test_get_eap_organization_volume_without_projects(self) -> None:
        organization = self.create_organization()

        org_volume = get_eap_organization_volume(
            self.get_config(organization), time_interval=timedelta(hours=1)
        )

        assert org_volume is None


class EAPTransactionVolumesTest(TestCase, SnubaTestCase, SpanTestCase):
    def get_config(self, organization: Organization) -> BaseDynamicSamplingConfiguration:
        with patch(
            "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
            return_value=1.0,
        ):
            return get_configuration(organization.id)

    def test_get_eap_transaction_volumes(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        other_project = self.create_project(organization=organization)
        other_organization = self.create_organization()
        other_organization_project = self.create_project(organization=other_organization)
        timestamp = before_now(minutes=15)

        self.store_spans(
            [
                self.create_span(
                    {"is_segment": True, "sentry_tags": {"transaction": "checkout"}},
                    organization=organization,
                    project=project,
                    start_ts=timestamp,
                ),
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {"transaction": "checkout"},
                        "measurements": {"server_sample_rate": {"value": 0.5}},
                    },
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=1),
                ),
                self.create_span(
                    {"is_segment": True, "sentry_tags": {"transaction": "product"}},
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=2),
                ),
                self.create_span(
                    {"is_segment": True, "sentry_tags": {"transaction": "checkout"}},
                    organization=organization,
                    project=other_project,
                    start_ts=timestamp + timedelta(seconds=3),
                ),
                self.create_span(
                    {"is_segment": False, "sentry_tags": {"transaction": "ignored-span"}},
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=4),
                ),
                self.create_span(
                    {"is_segment": True, "sentry_tags": {"transaction": "other-org"}},
                    organization=other_organization,
                    project=other_organization_project,
                    start_ts=timestamp,
                ),
            ]
        )

        volumes = get_eap_transaction_volumes(
            self.get_config(organization), time_interval=timedelta(hours=1)
        )

        assert volumes == [
            EAPProjectTransactionVolumes(
                org_id=organization.id,
                project_id=project.id,
                transaction_counts=[("checkout", 3), ("product", 1)],
                total_num_transactions=4,
                total_num_classes=2,
                indexed=3,
            ),
            EAPProjectTransactionVolumes(
                org_id=organization.id,
                project_id=other_project.id,
                transaction_counts=[("checkout", 1)],
                total_num_transactions=1,
                total_num_classes=1,
                indexed=1,
            ),
        ]

    def test_get_eap_transaction_volumes_without_projects(self) -> None:
        organization = self.create_organization()

        volumes = get_eap_transaction_volumes(
            self.get_config(organization), time_interval=timedelta(hours=1)
        )

        assert volumes == []
