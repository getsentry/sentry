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
                # owned by `project`, rooted at `project`
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "checkout",
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
                            "dsc.project_id": str(project.id),
                        },
                    },
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=4),
                ),
                # missing dsc.project_id — excluded by the root_project filter
                self.create_span(
                    {"is_segment": True, "sentry_tags": {"transaction": "no-root"}},
                    organization=organization,
                    project=project,
                    start_ts=timestamp + timedelta(seconds=5),
                ),
                # other org — excluded by org scope on SnubaParams
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "other-org",
                            "dsc.project_id": str(other_organization_project.id),
                        },
                    },
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
                            "dsc.project_id": str(originating_project.id),
                        },
                    },
                    organization=organization,
                    project=downstream_project,
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
                "project_id": originating_project.id,
                "transaction_counts": [("checkout", 1)],
                "total_num_transactions": 1,
                "total_num_classes": 1,
            }
        ]

    def test_get_eap_transaction_volumes_with_max_transactions_caps_total_rows(self) -> None:
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

        volumes = get_eap_transaction_volumes(
            self.get_config(organization),
            time_interval=timedelta(hours=1),
            order_by_volume="desc",
            max_transactions=2,
        )

        # Top 2 rows globally: project/alpha (3) and other_project/beta (2);
        # project/gamma is excluded by the cap.
        assert volumes == [
            {
                "org_id": organization.id,
                "project_id": project.id,
                "transaction_counts": [("alpha", 3)],
                "total_num_transactions": 3,
                "total_num_classes": 1,
            },
            {
                "org_id": organization.id,
                "project_id": other_project.id,
                "transaction_counts": [("beta", 2)],
                "total_num_transactions": 2,
                "total_num_classes": 1,
            },
        ]
