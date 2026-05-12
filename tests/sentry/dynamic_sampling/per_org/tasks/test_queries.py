from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.dynamic_sampling.per_org.tasks.configuration import (
    BaseDynamicSamplingConfiguration,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.tasks.queries import (
    get_eap_organization_volume,
    get_eap_transaction_volumes,
    run_eap_spans_table_query_in_chunks,
)
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.models.organization import Organization
from sentry.search.eap.constants import SAMPLING_MODE_HIGHEST_ACCURACY
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class EAPSpansTableQueryChunkingTest(TestCase, SnubaTestCase, SpanTestCase):
    def test_iterates_query_data_in_offset_chunks(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        other_project = self.create_project(organization=organization)
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
                    project=other_project,
                    start_ts=timestamp + timedelta(seconds=1),
                ),
            ]
        )

        rows = list(
            run_eap_spans_table_query_in_chunks(
                {
                    "params": SnubaParams(
                        start=timestamp - timedelta(minutes=1),
                        end=timestamp + timedelta(minutes=1),
                        projects=[project, other_project],
                        organization=organization,
                    ),
                    "query_string": "is_transaction:true",
                    "selected_columns": ["project.id", "count()", "count_sample()"],
                    "orderby": ["project.id"],
                    "referrer": Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_ORG_VOLUME.value,
                    "config": SearchResolverConfig(
                        auto_fields=True,
                        extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
                    ),
                    "sampling_mode": SAMPLING_MODE_HIGHEST_ACCURACY,
                },
                chunk_size=1,
            )
        )

        assert len(rows) == 2
        assert {row["project.id"] for row in rows} == {project.id, other_project.id}


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
            {
                "org_id": organization.id,
                "project_id": project.id,
                "transaction_counts": [("checkout", 3), ("product", 1)],
                "total_num_transactions": 4,
                "total_num_classes": 2,
            },
            {
                "org_id": organization.id,
                "project_id": other_project.id,
                "transaction_counts": [("checkout", 1)],
                "total_num_transactions": 1,
                "total_num_classes": 1,
            },
        ]

    def test_get_eap_transaction_volumes_without_projects(self) -> None:
        organization = self.create_organization()

        volumes = get_eap_transaction_volumes(
            self.get_config(organization), time_interval=timedelta(hours=1)
        )

        assert volumes == []

    def test_get_eap_transaction_volumes_with_max_transactions_limits_per_project(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        other_project = self.create_project(organization=organization)
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
                    {"is_segment": True, "sentry_tags": {"transaction": "product"}},
                    organization=organization,
                    project=other_project,
                    start_ts=timestamp + timedelta(seconds=4),
                ),
            ]
        )

        # max_transactions=1 should limit to 1 transaction per project, not 1 globally
        volumes = get_eap_transaction_volumes(
            self.get_config(organization),
            time_interval=timedelta(hours=1),
            order_by_volume="desc",
            max_transactions=1,
        )

        # Both projects should appear, each with only their top transaction
        assert len(volumes) == 2
        for vol in volumes:
            assert len(vol["transaction_counts"]) == 1
            assert vol["total_num_transactions"] is None
            assert vol["total_num_classes"] is None
