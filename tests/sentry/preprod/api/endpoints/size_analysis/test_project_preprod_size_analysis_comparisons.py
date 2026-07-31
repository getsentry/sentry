from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
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

    def _make_base(self, version, number, project=None):
        base = self.create_preprod_artifact(
            project=project or self.project,
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
            max_install_size=1000,
            max_download_size=500,
        )
        return base, metric

    def _watch_metric(self, artifact):
        return self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=300,
            max_download_size=150,
        )

    def _compare(
        self, head_metric, base_metric, file_id, state=PreprodArtifactSizeComparison.State.SUCCESS
    ):
        return self.create_preprod_artifact_size_comparison(
            head_size_analysis=head_metric,
            base_size_analysis=base_metric,
            organization=self.organization,
            state=state,
            file_id=file_id,
        )

    def _token_request(self, token, artifact_id=None):
        url = reverse(
            self.endpoint,
            args=[self.organization.slug, artifact_id or self.head_artifact.id],
        )
        return self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_invalid_token(self) -> None:
        response = self._token_request("invalid-token")
        assert response.status_code == 401

    def test_wrong_user(self) -> None:
        other_user = self.create_user("other@example.com")
        token = self.create_user_auth_token(
            other_user, scope_list=["org:admin", "project:admin"]
        ).token
        response = self._token_request(token)
        assert response.status_code == 403

    def test_missing_scopes(self) -> None:
        token = self.create_user_auth_token(self.user, scope_list=[]).token
        response = self._token_request(token)
        assert response.status_code == 403

    def test_cross_org_head_returns_404(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_artifact = self.create_preprod_artifact(
            project=other_project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        self.get_error_response(self.organization.slug, other_artifact.id, status_code=404)

    @patch(
        "sentry.preprod.api.endpoints.size_analysis.project_preprod_size_analysis_comparisons.get_size_retention_cutoff"
    )
    def test_returns_404_for_expired_head(self, mock_cutoff) -> None:
        mock_cutoff.return_value = timezone.now() - timedelta(days=30)
        self.head_artifact.date_added = timezone.now() - timedelta(days=60)
        self.head_artifact.save()

        response = self.get_error_response(
            self.organization.slug, self.head_artifact.id, status_code=404
        )
        assert response.data["detail"] == "This build's size data has expired."

    def test_invalid_search_query_returns_400(self) -> None:
        base, base_metric = self._make_base("2.0.0", 2)
        self._compare(self.head_metric, base_metric, file_id=1)

        response = self.get_error_response(
            self.organization.slug,
            self.head_artifact.id,
            qs_params={"query": "no_such_key:foo"},
            status_code=400,
        )
        assert response.data["detail"] == "Invalid search query."

    def test_returns_empty_when_no_comparisons(self) -> None:
        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        assert response.data == {"comparisons": []}

    def test_returns_empty_when_head_has_no_size_metrics(self) -> None:
        head_without_metrics = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )
        response = self.get_success_response(self.organization.slug, head_without_metrics.id)
        assert response.data == {"comparisons": []}

    def test_lists_comparison_where_build_is_head(self) -> None:
        base, base_metric = self._make_base("2.0.0", 2)
        self._compare(self.head_metric, base_metric, file_id=111)

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)

        comparisons = response.data["comparisons"]
        assert len(comparisons) == 1
        assert comparisons[0]["id"] == str(base.id)

    def test_excludes_comparison_where_build_is_base(self) -> None:
        # A newer build was compared against our build, so our build is the BASE
        # in that comparison. Head-only scope must not surface it here.
        _newer, newer_metric = self._make_base("4.0.0", 4)
        self._compare(newer_metric, self.head_metric, file_id=222)

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        assert response.data == {"comparisons": []}

    def test_excludes_base_in_another_project(self) -> None:
        # A comparison whose base build lives in another project (same org) must not be
        # surfaced — returned bases are scoped to the head's project.
        in_project_base, in_project_metric = self._make_base("2.0.0", 2)
        self._compare(self.head_metric, in_project_metric, file_id=1)

        other_project = self.create_project(organization=self.organization)
        _other_base, other_metric = self._make_base("4.0.0", 4, project=other_project)
        self._compare(self.head_metric, other_metric, file_id=2)

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        ids = [item["id"] for item in response.data["comparisons"]]
        assert ids == [str(in_project_base.id)]

    def test_only_returns_successful_comparisons(self) -> None:
        success_base, success_metric = self._make_base("2.0.0", 2)
        _failed_base, failed_metric = self._make_base("3.0.0", 3)
        _processing_base, processing_metric = self._make_base("4.0.0", 4)
        self._compare(self.head_metric, success_metric, file_id=1)
        self._compare(
            self.head_metric,
            failed_metric,
            file_id=2,
            state=PreprodArtifactSizeComparison.State.FAILED,
        )
        self._compare(
            self.head_metric,
            processing_metric,
            file_id=3,
            state=PreprodArtifactSizeComparison.State.PROCESSING,
        )

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        assert [item["id"] for item in response.data["comparisons"]] == [str(success_base.id)]

    def test_single_base_with_failed_and_successful_comparison(self) -> None:
        # A base with both a failed and a successful comparison still surfaces exactly
        # once, via its successful comparison.
        base, base_main_metric = self._make_base("2.0.0", 2)
        base_watch_metric = self._watch_metric(base)
        head_watch_metric = self._watch_metric(self.head_artifact)
        self._compare(self.head_metric, base_main_metric, file_id=1)
        self._compare(
            head_watch_metric,
            base_watch_metric,
            file_id=2,
            state=PreprodArtifactSizeComparison.State.FAILED,
        )

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        ids = [item["id"] for item in response.data["comparisons"]]
        assert ids == [str(base.id)]

    def test_multiple_bases_ordered_newest_first(self) -> None:
        older_base, older_metric = self._make_base("1.0.0", 1)
        newer_base, newer_metric = self._make_base("2.0.0", 2)

        older_cmp = self._compare(self.head_metric, older_metric, file_id=1)
        newer_cmp = self._compare(self.head_metric, newer_metric, file_id=2)
        PreprodArtifactSizeComparison.objects.filter(id=older_cmp.id).update(
            date_added=timezone.now() - timedelta(days=2)
        )
        PreprodArtifactSizeComparison.objects.filter(id=newer_cmp.id).update(
            date_added=timezone.now() - timedelta(days=1)
        )

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        assert [item["id"] for item in response.data["comparisons"]] == [
            str(newer_base.id),
            str(older_base.id),
        ]

    def test_collapses_per_metric_rows_into_one_item(self) -> None:
        base, base_main_metric = self._make_base("2.0.0", 2)
        head_watch_metric = self._watch_metric(self.head_artifact)
        base_watch_metric = self._watch_metric(base)
        self._compare(self.head_metric, base_main_metric, file_id=1)
        self._compare(head_watch_metric, base_watch_metric, file_id=2)

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        comparisons = response.data["comparisons"]
        assert len(comparisons) == 1
        assert comparisons[0]["id"] == str(base.id)

    @patch(
        "sentry.preprod.api.endpoints.size_analysis.project_preprod_size_analysis_comparisons.MAX_COMPARISONS",
        2,
    )
    def test_caps_results_to_max(self) -> None:
        # With more comparisons than the cap, only the most recent MAX_COMPARISONS are returned.
        _base_old, base_old_metric = self._make_base("1.0.0", 1)
        base_mid, base_mid_metric = self._make_base("2.0.0", 2)
        base_new, base_new_metric = self._make_base("3.0.0", 3)

        old_cmp = self._compare(self.head_metric, base_old_metric, file_id=1)
        mid_cmp = self._compare(self.head_metric, base_mid_metric, file_id=2)
        new_cmp = self._compare(self.head_metric, base_new_metric, file_id=3)

        PreprodArtifactSizeComparison.objects.filter(id=old_cmp.id).update(
            date_added=timezone.now() - timedelta(days=3)
        )
        PreprodArtifactSizeComparison.objects.filter(id=mid_cmp.id).update(
            date_added=timezone.now() - timedelta(days=2)
        )
        PreprodArtifactSizeComparison.objects.filter(id=new_cmp.id).update(
            date_added=timezone.now() - timedelta(days=1)
        )

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        ids = [item["id"] for item in response.data["comparisons"]]
        # Capped at 2 (most recent first); base_old is dropped.
        assert ids == [str(base_new.id), str(base_mid.id)]

    def test_download_count_for_installable_base(self) -> None:
        # Value check: an installable base's download_count is summed correctly in the
        # response. (No-N+1 isn't asserted here; it's structural via annotate_download_count.)
        base, base_metric = self._make_base("2.0.0", 2)
        base.installable_app_file_id = 12345
        base.save()
        self.create_preprod_artifact_mobile_app_info(preprod_artifact=base, build_number=2)
        self.create_installable_preprod_artifact(base, download_count=5)
        self.create_installable_preprod_artifact(base, download_count=10)
        self._compare(self.head_metric, base_metric, file_id=1)

        response = self.get_success_response(self.organization.slug, self.head_artifact.id)
        comparisons = response.data["comparisons"]
        assert len(comparisons) == 1
        distribution_info = comparisons[0]["distribution_info"]
        assert distribution_info["download_count"] == 15
        assert distribution_info["is_installable"] is True

    def test_filters_by_search_query(self) -> None:
        base_match, metric_match = self._make_base("9.9.9", 99)
        base_other, metric_other = self._make_base("1.0.0", 1)
        self._compare(self.head_metric, metric_match, file_id=1)
        self._compare(self.head_metric, metric_other, file_id=2)

        response = self.get_success_response(
            self.organization.slug,
            self.head_artifact.id,
            qs_params={"query": "build_version:9.9.9"},
        )
        returned_ids = [item["id"] for item in response.data["comparisons"]]
        assert returned_ids == [str(base_match.id)]
        assert str(base_other.id) not in returned_ids
