from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from sentry.dynamic_sampling.per_org.tasks.configuration import (
    BaseDynamicSamplingConfiguration,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.tasks.queries import (
    get_eap_organization_volume,
    run_eap_spans_table_query_in_chunks,
)
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.models.organization import Organization
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class EAPSpansTableQueryChunkingTest(TestCase):
    def test_iterates_query_data_in_offset_chunks(self) -> None:
        calls: list[tuple[int, int]] = []
        query = {"query_string": "is_transaction:true"}

        def run_table_query(**kwargs):
            calls.append((kwargs["offset"], kwargs["limit"]))
            assert kwargs["query_string"] == "is_transaction:true"

            if kwargs["offset"] == 0:
                return {"data": [{"project.id": 1}, {"project.id": 2}, {"project.id": 3}]}
            return {"data": [{"project.id": 3}]}

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.queries.Spans.run_table_query",
            side_effect=run_table_query,
        ):
            batches = list(run_eap_spans_table_query_in_chunks(query, chunk_size=2))

        assert batches == [
            [{"project.id": 1}, {"project.id": 2}],
            [{"project.id": 3}],
        ]
        assert calls == [(0, 3), (2, 3)]


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
