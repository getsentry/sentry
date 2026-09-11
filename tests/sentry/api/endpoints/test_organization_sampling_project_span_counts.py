from datetime import datetime, timedelta
from typing import Any

from sentry.models.project import Project
from sentry.testutils.cases import APITestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class OrganizationSamplingProjectSpanCountsTest(APITestCase, SnubaTestCase, SpanTestCase):
    endpoint = "sentry-api-0-organization-sampling-root-counts"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.root = self.create_project(organization=self.organization, teams=[self.team])
        self.other = self.create_project(organization=self.organization, teams=[self.team])

    def store_span(
        self,
        project: Project,
        root: Project | None = None,
        sample_rate: float | None = None,
        start_ts: datetime | None = None,
        environment: str | None = None,
    ) -> None:
        sentry_tags: dict[str, str] = {}
        if root is not None:
            sentry_tags["dsc.project_id"] = str(root.id)
        if environment is not None:
            sentry_tags["environment"] = environment
        measurements = (
            {"server_sample_rate": {"value": sample_rate}} if sample_rate is not None else None
        )
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": sentry_tags},
                    organization=self.organization,
                    project=project,
                    start_ts=start_ts or before_now(minutes=15),
                    measurements=measurements,
                )
            ]
        )

    def get_counts(self, **params: str) -> dict[str, Any]:
        with self.feature("organizations:dynamic-sampling-custom"):
            response = self.get_success_response(
                self.organization.slug, qs_params={"statsPeriod": "24h", **params}
            )
        return response.data

    @staticmethod
    def row(root: Project, project: Project, totals: float) -> dict[str, Any]:
        return {
            "by": {"project": root.slug, "target_project_id": str(project.id)},
            "totals": totals,
        }

    def test_feature_flag_required(self) -> None:
        self.get_error_response(self.organization.slug, status_code=404)

    def test_without_permission(self) -> None:
        self.login_as(self.create_user())

        with self.feature("organizations:dynamic-sampling-custom"):
            self.get_error_response(
                self.organization.slug, qs_params={"statsPeriod": "24h"}, status_code=403
            )

    def test_counts_received_spans_by_root_and_owning_project(self) -> None:
        self.store_span(self.root, root=self.root)
        # Sampled at 1/2, so it stands for 2 received spans.
        self.store_span(self.root, root=self.root, sample_rate=0.5)
        self.store_span(self.other, root=self.root)
        self.store_span(self.other, root=self.other)

        data = self.get_counts()

        assert data["data"] == [
            [
                self.row(self.root, self.root, 3),
                self.row(self.root, self.other, 1),
                self.row(self.other, self.other, 1),
            ]
        ]
        assert data["end"] - data["start"] == timedelta(days=1)

    def test_span_without_dsc_project_counts_under_its_own_project(self) -> None:
        self.store_span(self.other)
        self.store_span(self.other, root=self.other)

        data = self.get_counts()

        assert data["data"] == [[self.row(self.other, self.other, 2)]]

    def test_stats_period_selects_spans_by_time(self) -> None:
        self.store_span(self.root, root=self.root, start_ts=before_now(days=5))
        self.store_span(self.root, root=self.root)

        assert self.get_counts(statsPeriod="24h")["data"] == [[self.row(self.root, self.root, 1)]]

        data = self.get_counts(statsPeriod="30d")
        assert data["data"] == [[self.row(self.root, self.root, 2)]]
        assert data["end"] - data["start"] == timedelta(days=30)

    def test_environment_filters_spans(self) -> None:
        self.create_environment(project=self.root, name="prod")
        self.store_span(self.root, root=self.root, environment="prod")
        self.store_span(self.root, root=self.root, environment="dev")

        data = self.get_counts(environment="prod")

        assert data["data"] == [[self.row(self.root, self.root, 1)]]

    def test_no_spans(self) -> None:
        data = self.get_counts()

        assert data["data"] == [[]]
        assert data["end"] - data["start"] == timedelta(days=1)
