from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.dynamic_sampling.per_org.configuration import (
    BaseDynamicSamplingConfiguration,
    get_configuration,
)
from sentry.dynamic_sampling.per_org.gate import (
    TRANSACTION_VOLUMES_PER_PROJECT_ROLLOUT_RATE_OPTION,
)
from sentry.dynamic_sampling.per_org.queries import (
    DynamicSamplingQueryFields,
    DynamicSamplingQueryFilters,
    ProjectTransactionCounts,
    ProjectVolume,
    _get_eap_transaction_volumes_org_wide,
    get_eap_organization_volume,
    get_eap_project_volumes,
    get_eap_transaction_volumes,
    get_outcomes_organization_volume,
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
                    "query_string": DynamicSamplingQueryFilters.IS_SEGMENT,
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
    def get_config(
        self,
        organization: Organization,
    ) -> BaseDynamicSamplingConfiguration:
        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
        ):
            return get_configuration(organization.id)

    def test_get_eap_organization_volume_existing_org(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        with patch(
            "sentry.dynamic_sampling.per_org.queries.Spans.run_table_query",
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
            "sentry.dynamic_sampling.per_org.queries.Spans.run_table_query",
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
            "sentry.dynamic_sampling.per_org.queries.Spans.run_table_query",
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

        received = (datetime.now(UTC) - timedelta(seconds=120)).timestamp()
        with patch(
            "sentry.dynamic_sampling.per_org.queries.run_eap_spans_table_query_in_chunks",
            return_value=[
                {
                    "sentry.dsc.project_id": project.id,
                    "count()": 2,
                    "count_sample()": 2,
                    "count_unique(sentry.dsc.transaction)": 7,
                    "max(received)": received,
                },
                {
                    "sentry.dsc.project_id": other_project.id,
                    "count()": 1,
                    "count_sample()": 1,
                    "count_unique(sentry.dsc.transaction)": 1,
                },
            ],
        ) as run_table_query:
            project_volumes = get_eap_project_volumes(
                self.get_config(organization), time_interval=timedelta(hours=1)
            )

        volumes_by_id = {volume.project_id: volume for volume in project_volumes}
        assert [
            replace(volume, seconds_since_last_item=None) for volume in sorted(project_volumes)
        ] == [
            ProjectVolume(
                project_id=project.id, total=2, keep=2, drop=0, num_distinct_transactions=7
            ),
            ProjectVolume(
                project_id=other_project.id, total=1, keep=1, drop=0, num_distinct_transactions=1
            ),
        ]
        project_seconds = volumes_by_id[project.id].seconds_since_last_item
        assert project_seconds is not None and project_seconds > 100
        assert volumes_by_id[other_project.id].seconds_since_last_item is None
        run_table_query.assert_called_once()
        query = run_table_query.call_args.args[0]
        assert sorted(query["params"].projects, key=lambda p: p.id) == [
            project,
            other_project,
        ]
        assert query["query_string"] == DynamicSamplingQueryFilters.IS_SEGMENT
        assert query["selected_columns"] == [
            DynamicSamplingQueryFields.DSC_PROJECT_ID,
            DynamicSamplingQueryFields.COUNT,
            DynamicSamplingQueryFields.COUNT_SAMPLE,
            DynamicSamplingQueryFields.COUNT_UNIQUE_TRANSACTIONS,
            DynamicSamplingQueryFields.MAX_RECEIVED,
        ]
        assert query["orderby"] == [DynamicSamplingQueryFields.DSC_PROJECT_ID]
        assert query["referrer"] == Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_PROJECT_VOLUMES.value

    def test_get_eap_project_volumes_without_traffic(self) -> None:
        organization = self.create_organization()
        self.create_project(organization=organization)

        with patch(
            "sentry.dynamic_sampling.per_org.queries.run_eap_spans_table_query_in_chunks",
            return_value=[],
        ):
            project_volumes = get_eap_project_volumes(
                self.get_config(organization), time_interval=timedelta(hours=1)
            )

        assert project_volumes == []

    def test_get_eap_project_volumes_handles_missing_aggregate_values(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        with patch(
            "sentry.dynamic_sampling.per_org.queries.run_eap_spans_table_query_in_chunks",
            return_value=[
                {
                    "sentry.dsc.project_id": project.id,
                }
            ],
        ):
            project_volumes = get_eap_project_volumes(self.get_config(organization))

        assert project_volumes == [ProjectVolume(project_id=project.id, total=0, keep=0, drop=0)]

    def test_get_eap_project_volumes_skips_rows_without_dsc_project_id(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        with patch(
            "sentry.dynamic_sampling.per_org.queries.run_eap_spans_table_query_in_chunks",
            return_value=[
                {
                    "sentry.dsc.project_id": None,
                    "count()": 3,
                    "count_sample()": 1,
                },
                {
                    "sentry.dsc.project_id": project.id,
                    "count()": 2,
                    "count_sample()": 1,
                },
            ],
        ):
            project_volumes = get_eap_project_volumes(self.get_config(organization))

        assert project_volumes == [ProjectVolume(project_id=project.id, total=2, keep=1, drop=1)]

    def test_get_eap_project_volumes_without_projects(self) -> None:
        organization = self.create_organization()

        with patch(
            "sentry.dynamic_sampling.per_org.queries.run_eap_spans_table_query_in_chunks",
            return_value=[],
        ) as run_table_query:
            project_volumes = get_eap_project_volumes(
                self.get_config(organization), time_interval=timedelta(hours=1)
            )

        assert project_volumes == []
        run_table_query.assert_called_once()
        query = run_table_query.call_args.args[0]
        assert query["params"].projects == []

    def test_get_outcomes_organization_volume_existing_org(self) -> None:
        organization = self.create_organization()

        with patch(
            "sentry.dynamic_sampling.per_org.queries.run_outcomes_query_totals",
            return_value=[{"quantity": 10}],
        ) as run_outcomes_query_totals:
            org_volume = get_outcomes_organization_volume(
                self.get_config(organization), time_interval=timedelta(hours=24)
            )

        assert org_volume == OrganizationDataVolume(org_id=organization.id, total=10, indexed=None)
        run_outcomes_query_totals.assert_called_once()
        assert run_outcomes_query_totals.call_args.kwargs["tenant_ids"] == {
            "organization_id": organization.id
        }

    def test_get_outcomes_organization_volume_without_traffic(self) -> None:
        organization = self.create_organization()

        with patch(
            "sentry.dynamic_sampling.per_org.queries.run_outcomes_query_totals",
            return_value=[],
        ):
            org_volume = get_outcomes_organization_volume(
                self.get_config(organization), time_interval=timedelta(hours=24)
            )

        assert org_volume is None


class EAPTransactionVolumesTest(TestCase, SnubaTestCase, SpanTestCase):
    def get_config(self, organization: Organization) -> BaseDynamicSamplingConfiguration:
        with patch(
            "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
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
                # owned by `project`, rooted at `project`
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "checkout",
                            "dsc.transaction": "checkout",
                            "dsc.project_id": str(project.id),
                        },
                    },
                    organization=organization,
                    project=project,
                    start_ts=timestamp,
                ),
                # owned by `other_project` but rooted at `project` — must count toward `project`
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "checkout",
                            "dsc.transaction": "checkout",
                            "dsc.project_id": str(project.id),
                        },
                        "measurements": {"server_sample_rate": {"value": 0.5}},
                    },
                    organization=organization,
                    project=other_project,
                    start_ts=timestamp + timedelta(seconds=1),
                ),
                # owned by `project`, rooted at `project`
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "product",
                            "dsc.transaction": "product",
                            "dsc.project_id": str(project.id),
                        },
                    },
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=2),
                ),
                # owned by `project` but rooted at `other_project` — must count toward `other_project`
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "checkout",
                            "dsc.transaction": "checkout",
                            "dsc.project_id": str(other_project.id),
                        },
                    },
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=3),
                ),
                # non-segment span — excluded by is_transaction:true
                self.create_span(
                    {
                        "is_segment": False,
                        "sentry_tags": {
                            "transaction": "ignored-span",
                            "dsc.transaction": "ignored-span",
                            "dsc.project_id": str(project.id),
                        },
                    },
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=4),
                ),
                # missing dsc.project_id — excluded by the root_project filter
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "no-root",
                            "dsc.transaction": "no-root",
                        },
                    },
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=5),
                ),
                # missing dsc.transaction — excluded by the has:sentry.dsc.transaction filter
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "no-dsc-transaction",
                            "dsc.project_id": str(project.id),
                        },
                    },
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=6),
                ),
                # other org — excluded by org scope on SnubaParams
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "other-org",
                            "dsc.transaction": "other-org",
                            "dsc.project_id": str(other_organization_project.id),
                        },
                    },
                    organization=other_organization,
                    project=other_organization_project,
                    start_ts=timestamp,
                ),
            ]
        )

        with self.options({TRANSACTION_VOLUMES_PER_PROJECT_ROLLOUT_RATE_OPTION: 1.0}):
            volumes = get_eap_transaction_volumes(self.get_config(organization))

        org_wide_volumes = _get_eap_transaction_volumes_org_wide(
            self.get_config(organization),
            order_by_volume="desc",
        )

        expected = [
            ProjectTransactionCounts(
                org_id=organization.id,
                project_id=project.id,
                transaction_counts=[("checkout", 3), ("product", 1)],
            ),
            ProjectTransactionCounts(
                org_id=organization.id,
                project_id=other_project.id,
                transaction_counts=[("checkout", 1)],
            ),
        ]
        assert volumes == expected
        assert org_wide_volumes == expected

    def test_get_eap_transaction_volumes_filters_by_root_projects(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        other_project = self.create_project(organization=organization)
        timestamp = before_now(minutes=15)

        self.store_spans(
            [
                # Rooted at `project` but owned by `other_project` — must still be counted
                # even though `other_project` is not in root_projects.
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "checkout",
                            "dsc.transaction": "checkout",
                            "dsc.project_id": str(project.id),
                        },
                    },
                    organization=organization,
                    project=other_project,
                    start_ts=timestamp,
                ),
                # Rooted at `other_project` — excluded by root_projects.
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "landing",
                            "dsc.transaction": "landing",
                            "dsc.project_id": str(other_project.id),
                        },
                    },
                    organization=organization,
                    project=other_project,
                    start_ts=timestamp + timedelta(seconds=1),
                ),
            ]
        )

        expected = [
            ProjectTransactionCounts(
                org_id=organization.id,
                project_id=project.id,
                transaction_counts=[("checkout", 1)],
            )
        ]

        # Default rollout rate of 0.0 selects the org-wide query.
        volumes = get_eap_transaction_volumes(
            self.get_config(organization),
            root_projects=[project],
        )
        assert volumes == expected

        with self.options({TRANSACTION_VOLUMES_PER_PROJECT_ROLLOUT_RATE_OPTION: 1.0}):
            volumes = get_eap_transaction_volumes(
                self.get_config(organization),
                root_projects=[project],
            )
        assert volumes == expected

    def test_get_eap_transaction_volumes_without_projects(self) -> None:
        organization = self.create_organization()

        volumes = get_eap_transaction_volumes(self.get_config(organization))
        assert volumes == []

        with self.options({TRANSACTION_VOLUMES_PER_PROJECT_ROLLOUT_RATE_OPTION: 1.0}):
            volumes = get_eap_transaction_volumes(self.get_config(organization))
        assert volumes == []

    def test_get_eap_transaction_volumes_attributes_to_originating_project(self) -> None:
        organization = self.create_organization()
        originating_project = self.create_project(organization=organization)
        downstream_project = self.create_project(organization=organization)
        timestamp = before_now(minutes=15)

        self.store_spans(
            [
                # Owned by `downstream_project` but originated in `originating_project`.
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "checkout",
                            "dsc.transaction": "checkout",
                            "dsc.project_id": str(originating_project.id),
                        },
                    },
                    organization=organization,
                    project=downstream_project,
                    start_ts=timestamp,
                ),
            ]
        )

        expected = [
            ProjectTransactionCounts(
                org_id=organization.id,
                project_id=originating_project.id,
                transaction_counts=[("checkout", 1)],
            )
        ]

        # Default rollout rate of 0.0 selects the org-wide query.
        volumes = get_eap_transaction_volumes(self.get_config(organization))
        assert volumes == expected

        with self.options({TRANSACTION_VOLUMES_PER_PROJECT_ROLLOUT_RATE_OPTION: 1.0}):
            volumes = get_eap_transaction_volumes(self.get_config(organization))
        assert volumes == expected

    def test_get_eap_transaction_volumes_caps_transactions_per_project(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        other_project = self.create_project(organization=organization)
        timestamp = before_now(minutes=15)

        def segment(transaction, root_project_id, project, offset):
            return self.create_span(
                {
                    "is_segment": True,
                    "sentry_tags": {
                        "transaction": transaction,
                        "dsc.transaction": transaction,
                        "dsc.project_id": str(root_project_id),
                    },
                },
                organization=organization,
                project=project,
                start_ts=timestamp + timedelta(seconds=offset),
            )

        self.store_spans(
            [
                # project/alpha → count = 3
                segment("alpha", project.id, project, 0),
                segment("alpha", project.id, project, 1),
                segment("alpha", project.id, project, 2),
                # project/beta → count = 2
                segment("beta", project.id, project, 3),
                segment("beta", project.id, project, 4),
                # project/gamma → count = 1 (excluded by the per-project cap)
                segment("gamma", project.id, project, 5),
                # other_project/delta → count = 1 (kept: the cap applies per project)
                segment("delta", other_project.id, other_project, 6),
            ]
        )

        with self.options({TRANSACTION_VOLUMES_PER_PROJECT_ROLLOUT_RATE_OPTION: 1.0}):
            volumes = get_eap_transaction_volumes(
                self.get_config(organization),
                max_transactions_per_project=2,
            )

        assert volumes == [
            ProjectTransactionCounts(
                org_id=organization.id,
                project_id=project.id,
                transaction_counts=[("alpha", 3), ("beta", 2)],
            ),
            ProjectTransactionCounts(
                org_id=organization.id,
                project_id=other_project.id,
                transaction_counts=[("delta", 1)],
            ),
        ]

        # At the default rollout rate of 0.0 the org-wide query runs instead, which has
        # no per-project cap: project/gamma is included.
        volumes = get_eap_transaction_volumes(
            self.get_config(organization),
            max_transactions_per_project=2,
        )
        volumes_by_project = {volume.project_id: volume for volume in volumes}
        assert ("gamma", 1) in volumes_by_project[project.id].transaction_counts

    def test_get_eap_transaction_volumes_reads_cap_from_legacy_option(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        timestamp = before_now(minutes=15)

        def segment(transaction, offset):
            return self.create_span(
                {
                    "is_segment": True,
                    "sentry_tags": {
                        "transaction": transaction,
                        "dsc.transaction": transaction,
                        "dsc.project_id": str(project.id),
                    },
                },
                organization=organization,
                project=project,
                start_ts=timestamp + timedelta(seconds=offset),
            )

        self.store_spans(
            [
                segment("alpha", 0),
                segment("alpha", 1),
                segment("beta", 2),
            ]
        )

        with self.options(
            {
                TRANSACTION_VOLUMES_PER_PROJECT_ROLLOUT_RATE_OPTION: 1.0,
                "dynamic-sampling.prioritise_transactions.num_explicit_large_transactions": 1,
            }
        ):
            volumes = get_eap_transaction_volumes(self.get_config(organization))

        assert volumes == [
            ProjectTransactionCounts(
                org_id=organization.id,
                project_id=project.id,
                transaction_counts=[("alpha", 2)],
            )
        ]

    def test_get_eap_transaction_volumes_project_over_cap_does_not_starve_other_projects(
        self,
    ) -> None:
        organization = self.create_organization()
        busy_project = self.create_project(organization=organization)
        quiet_project = self.create_project(organization=organization)
        timestamp = before_now(minutes=15)

        def segment(transaction, project, offset):
            return self.create_span(
                {
                    "is_segment": True,
                    "sentry_tags": {
                        "transaction": transaction,
                        "dsc.transaction": transaction,
                        "dsc.project_id": str(project.id),
                    },
                },
                organization=organization,
                project=project,
                start_ts=timestamp + timedelta(seconds=offset),
            )

        spans = []
        # busy_project has more distinct transactions than the per-project cap; with
        # the previous global row limit its rows consumed the entire result and
        # quiet_project never reached the balancing step.
        for i in range(4):
            spans.append(segment(f"busy-{i}", busy_project, i))
        for i in range(2):
            spans.append(segment("quiet-low", quiet_project, 10 + i))
        for i in range(3):
            spans.append(segment("quiet-high", quiet_project, 20 + i))
        self.store_spans(spans)

        with self.options({TRANSACTION_VOLUMES_PER_PROJECT_ROLLOUT_RATE_OPTION: 1.0}):
            volumes = get_eap_transaction_volumes(
                self.get_config(organization),
                max_transactions_per_project=3,
            )

        volumes_by_project = {volume.project_id: volume for volume in volumes}
        assert len(volumes_by_project[busy_project.id].transaction_counts) == 3
        assert volumes_by_project[quiet_project.id].transaction_counts == [
            ("quiet-high", 3),
            ("quiet-low", 2),
        ]

    def test_get_eap_transaction_volumes_org_wide_caps_total_rows(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        other_project = self.create_project(organization=organization)
        timestamp = before_now(minutes=15)

        def segment(transaction, root_project_id, project, offset):
            return self.create_span(
                {
                    "is_segment": True,
                    "sentry_tags": {
                        "transaction": transaction,
                        "dsc.transaction": transaction,
                        "dsc.project_id": str(root_project_id),
                    },
                },
                organization=organization,
                project=project,
                start_ts=timestamp + timedelta(seconds=offset),
            )

        self.store_spans(
            [
                # project/alpha → count = 3
                segment("alpha", project.id, project, 0),
                segment("alpha", project.id, project, 1),
                segment("alpha", project.id, project, 2),
                # other_project/beta → count = 2
                segment("beta", other_project.id, other_project, 3),
                segment("beta", other_project.id, other_project, 4),
                # project/gamma → count = 1 (excluded by the global cap)
                segment("gamma", project.id, project, 5),
            ]
        )

        volumes = _get_eap_transaction_volumes_org_wide(
            self.get_config(organization),
            order_by_volume="desc",
            max_transactions=2,
        )

        # Top 2 rows globally: project/alpha (3) and other_project/beta (2);
        # project/gamma is excluded by the cap.
        assert volumes == [
            ProjectTransactionCounts(
                org_id=organization.id,
                project_id=project.id,
                transaction_counts=[("alpha", 3)],
            ),
            ProjectTransactionCounts(
                org_id=organization.id,
                project_id=other_project.id,
                transaction_counts=[("beta", 2)],
            ),
        ]
