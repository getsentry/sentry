from datetime import timedelta

from django.utils import timezone

from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.testutils.cases import APITestCase


class ProjectPreprodSizeAnalysisComparisonsTest(APITestCase):
    endpoint = "sentry-api-0-organization-preprod-artifact-size-analysis-comparisons"
    method = "get"

    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(user=self.user)

        self.head_artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.create_file(name="head.apk", type="application/octet-stream").id,
            app_name="TestApp",
            app_id="com.test.app",
            build_version="3.0.0",
            build_number=3,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        self.head_metric = self.create_preprod_artifact_size_metrics(
            self.head_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=2000,
            max_download_size=1000,
        )

    def _make_base(self, version, number, install=1000, download=500):
        base = self.create_preprod_artifact(
            project=self.project,
            file_id=self.create_file(
                name=f"base-{version}.apk", type="application/octet-stream"
            ).id,
            app_name="TestApp",
            app_id="com.test.app",
            build_version=version,
            build_number=number,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        metric = self.create_preprod_artifact_size_metrics(
            base,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=install,
            max_download_size=download,
        )
        return base, metric

    def test_returns_empty_when_no_comparisons(self) -> None:
        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        assert response.data == []

    def test_lists_comparison_where_build_is_head(self) -> None:
        base, base_metric = self._make_base("2.0.0", 2)
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=self.head_metric,
            base_size_analysis=base_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=111,
        )

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)

        assert len(response.data) == 1
        item = response.data[0]
        assert item["base_build_details"]["id"] == str(base.id)
        assert item["state"] == "success"
        assert "date_added" in item

    def test_excludes_comparison_where_build_is_base(self) -> None:
        # A newer build was compared against our build, so our build is the BASE
        # in that comparison. Head-only scope must not surface it here.
        _newer, newer_metric = self._make_base("4.0.0", 4)
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=newer_metric,
            base_size_analysis=self.head_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=222,
        )

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        assert response.data == []

    def test_multiple_bases_ordered_newest_first(self) -> None:
        older_base, older_metric = self._make_base("1.0.0", 1)
        newer_base, newer_metric = self._make_base("2.0.0", 2)

        older_cmp = self.create_preprod_artifact_size_comparison(
            head_size_analysis=self.head_metric,
            base_size_analysis=older_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=1,
        )
        newer_cmp = self.create_preprod_artifact_size_comparison(
            head_size_analysis=self.head_metric,
            base_size_analysis=newer_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=2,
        )
        PreprodArtifactSizeComparison.objects.filter(id=older_cmp.id).update(
            date_added=timezone.now() - timedelta(days=2)
        )
        PreprodArtifactSizeComparison.objects.filter(id=newer_cmp.id).update(
            date_added=timezone.now() - timedelta(days=1)
        )

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        assert [item["base_build_details"]["id"] for item in response.data] == [
            str(newer_base.id),
            str(older_base.id),
        ]

    def test_collapses_per_metric_rows_into_one_item(self) -> None:
        base, base_main_metric = self._make_base("2.0.0", 2)
        head_watch_metric = self.create_preprod_artifact_size_metrics(
            self.head_artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=300,
            max_download_size=150,
        )
        base_watch_metric = self.create_preprod_artifact_size_metrics(
            base,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=300,
            max_download_size=150,
        )
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=self.head_metric,
            base_size_analysis=base_main_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=1,
        )
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=head_watch_metric,
            base_size_analysis=base_watch_metric,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=2,
        )

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        assert len(response.data) == 1
        assert response.data[0]["base_build_details"]["id"] == str(base.id)

    def test_filters_by_search_query(self) -> None:
        base_match, metric_match = self._make_base("9.9.9", 99)
        base_other, metric_other = self._make_base("1.0.0", 1)
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=self.head_metric,
            base_size_analysis=metric_match,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=1,
        )
        self.create_preprod_artifact_size_comparison(
            head_size_analysis=self.head_metric,
            base_size_analysis=metric_other,
            organization=self.organization,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
            file_id=2,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.head_artifact.id,
            qs_params={"query": "build_version:9.9.9"},
        )
        assert [item["base_build_details"]["id"] for item in response.data] == [str(base_match.id)]
        assert base_other.id != base_match.id
