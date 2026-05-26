from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.dynamic_sampling.per_org.tasks.configuration import (
    BaseDynamicSamplingConfiguration,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.tasks.queries import (
    DynamicSamplingQueryFields,
    DynamicSamplingQueryFilters,
    ProjectVolume,
    get_eap_organization_volume,
    get_eap_project_volumes,
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
        assert {row["project.id"] for row in rows} == {
            project.id,
            other_project.id,
        }


class EAPOrganizationVolumeTest(TestCase, SnubaTestCase, SpanTestCase):
    def get_config(
        self,
        organization: Organization,
    ) -> BaseDynamicSamplingConfiguration:
        with patch(
            "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
            return_value=1.0,
        ):
            return get_configuration(organization.id)

    def test_get_eap_organization_volume_existing_org(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.queries.Spans.run_table_query",
            return_value={"data": [{DynamicSamplingQueryFields.COUNT: 2, "count_sample()": 2}]},
        ) as run_table_query:
            org_volume = get_eap_organization_volume(
                self.get_config(organization), time_interval=timedelta(hours=1)
            )

        assert org_volume == OrganizationDataVolume(org_id=organization.id, total=2, indexed=2)
        run_table_query.assert_called_once()
        assert run_table_query.call_args.kwargs["params"].projects == [project]
        assert (
            run_table_query.call_args.kwargs["query_string"]
            == DynamicSamplingQueryFilters.IS_SEGMENT
        )
        assert run_table_query.call_args.kwargs["selected_columns"] == [
            DynamicSamplingQueryFields.COUNT,
            DynamicSamplingQueryFields.COUNT_SAMPLE,
        ]
        assert (
            run_table_query.call_args.kwargs["referrer"]
            == Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_ORG_VOLUME.value
        )

    def test_get_eap_organization_volume_returns_raw_and_extrapolated_counts(self) -> None:
        organization = self.create_organization()
        self.create_project(organization=organization)

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.queries.Spans.run_table_query",
            return_value={"data": [{"count()": 10, DynamicSamplingQueryFields.COUNT_SAMPLE: 1}]},
        ):
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

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.queries.Spans.run_table_query",
            return_value={"data": []},
        ) as run_table_query:
            org_volume = get_eap_organization_volume(
                self.get_config(organization), time_interval=timedelta(hours=1)
            )

        assert org_volume is None
        run_table_query.assert_called_once()
        assert run_table_query.call_args.kwargs["params"].projects == []

    def test_get_eap_project_volumes_existing_org(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        other_project = self.create_project(organization=organization)
        other_organization = self.create_organization()
        self.create_project(organization=other_organization)

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.queries.run_eap_spans_table_query_in_chunks",
            return_value=[
                {
                    "sentry.dsc.root_project": project.id,
                    "count()": 2,
                    "count_sample()": 2,
                },
                {
                    "sentry.dsc.root_project": other_project.id,
                    "count()": 1,
                    "count_sample()": 1,
                },
            ],
        ) as run_table_query:
            project_volumes = get_eap_project_volumes(
                self.get_config(organization), time_interval=timedelta(hours=1)
            )

        assert sorted(project_volumes) == [
            ProjectVolume(project_id=project.id, total=2, keep=2, drop=0),
            ProjectVolume(project_id=other_project.id, total=1, keep=1, drop=0),
        ]
        run_table_query.assert_called_once()
        query = run_table_query.call_args.args[0]
        assert sorted(query["params"].projects, key=lambda p: p.id) == [
            project,
            other_project,
        ]
        assert query["query_string"] == DynamicSamplingQueryFilters.IS_SEGMENT
        assert query["selected_columns"] == [
            DynamicSamplingQueryFields.ROOT_PROJECT,
            DynamicSamplingQueryFields.COUNT,
            DynamicSamplingQueryFields.COUNT_SAMPLE,
        ]
        assert query["orderby"] == [DynamicSamplingQueryFields.ROOT_PROJECT]
        assert query["referrer"] == Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_PROJECT_VOLUMES.value

    def test_get_eap_project_volumes_without_traffic(self) -> None:
        organization = self.create_organization()
        self.create_project(organization=organization)

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.queries.Spans.run_table_query",
            return_value={"data": []},
        ):
            project_volumes = get_eap_project_volumes(
                self.get_config(organization), time_interval=timedelta(hours=1)
            )

        assert project_volumes == []

    def test_get_eap_project_volumes_handles_missing_aggregate_values(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.queries.run_eap_spans_table_query_in_chunks",
            return_value=[
                {
                    "sentry.dsc.root_project": project.id,
                }
            ],
        ):
            project_volumes = get_eap_project_volumes(self.get_config(organization))

        assert project_volumes == [ProjectVolume(project_id=project.id, total=0, keep=0, drop=0)]

    def test_get_eap_project_volumes_without_projects(self) -> None:
        organization = self.create_organization()

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.queries.Spans.run_table_query",
            return_value={"data": []},
        ) as run_table_query:
            project_volumes = get_eap_project_volumes(
                self.get_config(organization), time_interval=timedelta(hours=1)
            )

        assert project_volumes == []
        run_table_query.assert_called_once()
        assert run_table_query.call_args.kwargs["params"].projects == []
