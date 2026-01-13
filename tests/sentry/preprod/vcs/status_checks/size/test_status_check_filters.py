from __future__ import annotations

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
    PreprodBuildConfiguration,
)
from sentry.preprod.vcs.status_checks.size.tasks import (
    StatusCheckRule,
    _compute_overall_status,
    _evaluate_rule_threshold,
    _fetch_base_size_metrics,
    _get_artifact_filter_context,
    _get_status_check_rules,
    _rule_matches_artifact,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class StatusCheckFiltersTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )

        self.commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        self.build_config_debug = PreprodBuildConfiguration.objects.create(
            project=self.project,
            name="Debug",
        )

        self.build_config_release = PreprodBuildConfiguration.objects.create(
            project=self.project,
            name="Release",
        )

    def test_filter_context_includes_build_configuration(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
            build_configuration_id=self.build_config_debug.id,
        )

        context = _get_artifact_filter_context(artifact)

        assert context["platform"] == "ios"
        assert context["git_head_ref"] == "feature/test"
        assert context["app_id"] == "com.example.app"
        assert context["build_configuration"] == "Debug"

    def test_filter_context_without_build_configuration(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            app_id="com.example.android",
            commit_comparison=self.commit_comparison,
        )

        context = _get_artifact_filter_context(artifact)

        assert context["platform"] == "android"
        assert context["git_head_ref"] == "feature/test"
        assert context["app_id"] == "com.example.android"
        assert "build_configuration" not in context

    def test_rule_matches_build_configuration_single_value(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
            build_configuration_id=self.build_config_debug.id,
        )

        context = _get_artifact_filter_context(artifact)

        rule_debug = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="build_configuration:Debug",
        )

        rule_release = StatusCheckRule(
            id="rule2",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="build_configuration:Release",
        )

        assert _rule_matches_artifact(rule_debug, context) is True
        assert _rule_matches_artifact(rule_release, context) is False

    def test_rule_matches_build_configuration_multiple_values(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
            build_configuration_id=self.build_config_release.id,
        )

        context = _get_artifact_filter_context(artifact)

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="build_configuration:[Debug,Release]",
        )

        assert _rule_matches_artifact(rule, context) is True

    def test_rule_matches_build_configuration_negated(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
            build_configuration_id=self.build_config_debug.id,
        )

        context = _get_artifact_filter_context(artifact)

        rule_not_release = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="!build_configuration:Release",
        )

        rule_not_debug = StatusCheckRule(
            id="rule2",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="!build_configuration:Debug",
        )

        assert _rule_matches_artifact(rule_not_release, context) is True
        assert _rule_matches_artifact(rule_not_debug, context) is False

    def test_rule_matches_combined_filters(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
            build_configuration_id=self.build_config_release.id,
        )

        context = _get_artifact_filter_context(artifact)

        rule_ios_release = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="platform:ios build_configuration:Release",
        )

        rule_android_release = StatusCheckRule(
            id="rule2",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="platform:android build_configuration:Release",
        )

        rule_ios_debug = StatusCheckRule(
            id="rule3",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="platform:ios build_configuration:Debug",
        )

        assert _rule_matches_artifact(rule_ios_release, context) is True
        assert _rule_matches_artifact(rule_android_release, context) is False
        assert _rule_matches_artifact(rule_ios_debug, context) is False

    def test_status_check_fails_when_rule_matches_and_exceeds_threshold(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
            build_configuration_id=self.build_config_debug.id,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=150 * 1024 * 1024,
            max_install_size=150 * 1024 * 1024,
        )

        size_metrics_map = {
            artifact.id: list(PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=artifact))
        }

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="build_configuration:Debug",
        )

        status, triggered_rules = _compute_overall_status(
            [artifact], size_metrics_map, rules=[rule]
        )
        assert status == StatusCheckStatus.FAILURE
        assert triggered_rules == [rule]

    def test_status_check_succeeds_when_rule_matches_but_under_threshold(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
            build_configuration_id=self.build_config_debug.id,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=50 * 1024 * 1024,
            max_install_size=50 * 1024 * 1024,
        )

        size_metrics_map = {
            artifact.id: list(PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=artifact))
        }

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="build_configuration:Debug",
        )

        status, triggered_rules = _compute_overall_status(
            [artifact], size_metrics_map, rules=[rule]
        )
        assert status == StatusCheckStatus.SUCCESS
        assert triggered_rules == []

    def test_status_check_succeeds_when_rule_does_not_match(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
            build_configuration_id=self.build_config_release.id,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            min_download_size=1024 * 1024,
            max_download_size=1024 * 1024,
            min_install_size=150 * 1024 * 1024,
            max_install_size=150 * 1024 * 1024,
        )

        size_metrics_map = {
            artifact.id: list(PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=artifact))
        }

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="build_configuration:Debug",
        )

        status, triggered_rules = _compute_overall_status(
            [artifact], size_metrics_map, rules=[rule]
        )
        assert status == StatusCheckStatus.SUCCESS
        assert triggered_rules == []

    def test_parse_rules_from_project_options(self):
        self.project.update_option(
            "sentry:preprod_size_status_checks_enabled",
            True,
        )
        self.project.update_option(
            "sentry:preprod_size_status_checks_rules",
            '[{"id": "rule1", "metric": "install_size", "measurement": "absolute", '
            '"value": 100, "filterQuery": "build_configuration:Debug"}]',
        )

        rules = _get_status_check_rules(self.project)

        assert len(rules) == 1
        assert rules[0].id == "rule1"
        assert rules[0].metric == "install_size"
        assert rules[0].measurement == "absolute"
        assert rules[0].value == 100
        assert rules[0].filter_query == "build_configuration:Debug"

    def test_evaluate_absolute_diff_threshold_exceeds(self):
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=self.commit_comparison,
        )

        head_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=60 * 1024 * 1024,
        )

        base_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=base_commit_comparison,
        )

        base_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=50 * 1024 * 1024,
        )

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute_diff",
            value=5 * 1024 * 1024,
            filter_query="",
        )

        assert _evaluate_rule_threshold(rule, head_metrics, base_metrics) is True

    def test_evaluate_absolute_diff_threshold_under(self):
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=self.commit_comparison,
        )

        head_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=53 * 1024 * 1024,
        )

        base_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=base_commit_comparison,
        )

        base_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=50 * 1024 * 1024,
        )

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute_diff",
            value=5 * 1024 * 1024,
            filter_query="",
        )

        assert _evaluate_rule_threshold(rule, head_metrics, base_metrics) is False

    def test_evaluate_relative_diff_threshold_exceeds(self):
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=self.commit_comparison,
        )

        head_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=60 * 1024 * 1024,
        )

        base_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=base_commit_comparison,
        )

        base_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=50 * 1024 * 1024,
        )

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="relative_diff",
            value=10,
            filter_query="",
        )

        assert _evaluate_rule_threshold(rule, head_metrics, base_metrics) is True

    def test_evaluate_relative_diff_threshold_under(self):
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=self.commit_comparison,
        )

        head_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=54 * 1024 * 1024,
        )

        base_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=base_commit_comparison,
        )

        base_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=50 * 1024 * 1024,
        )

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="relative_diff",
            value=10,
            filter_query="",
        )

        assert _evaluate_rule_threshold(rule, head_metrics, base_metrics) is False

    def test_evaluate_rule_with_no_base_metrics_returns_false(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=self.commit_comparison,
        )

        size_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=60 * 1024 * 1024,
        )

        rule_absolute_diff = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute_diff",
            value=5 * 1024 * 1024,
            filter_query="",
        )

        rule_relative_diff = StatusCheckRule(
            id="rule2",
            metric="install_size",
            measurement="relative_diff",
            value=10,
            filter_query="",
        )

        assert _evaluate_rule_threshold(rule_absolute_diff, size_metrics, None) is False
        assert _evaluate_rule_threshold(rule_relative_diff, size_metrics, None) is False

    def test_fetch_base_size_metrics_with_matching_build_config(self):
        base_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        head_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=base_commit_comparison,
            app_id="com.example.app",
            build_configuration=self.build_config_release,
        )

        base_metrics = PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=50 * 1024 * 1024,
        )

        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=head_commit_comparison,
            app_id="com.example.app",
            build_configuration=self.build_config_release,
        )

        result = _fetch_base_size_metrics([head_artifact], self.project)

        assert head_artifact.id in result
        assert result[head_artifact.id].id == base_metrics.id

    def test_fetch_base_size_metrics_with_different_build_config(self):
        base_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        head_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=base_commit_comparison,
            app_id="com.example.app",
            build_configuration=self.build_config_release,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=50 * 1024 * 1024,
        )

        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=head_commit_comparison,
            app_id="com.example.app",
            build_configuration=self.build_config_debug,
        )

        result = _fetch_base_size_metrics([head_artifact], self.project)

        assert result == {}

    def test_status_check_with_absolute_diff_rule(self):
        base_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="b" * 40,
            base_sha="c" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        head_commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
        )

        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=base_commit_comparison,
            app_id="com.example.app",
            build_configuration=self.build_config_release,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=base_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=50 * 1024 * 1024,
        )

        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=head_commit_comparison,
            app_id="com.example.app",
            build_configuration=self.build_config_release,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=head_artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=60 * 1024 * 1024,
        )

        size_metrics_map = {
            head_artifact.id: list(
                PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=head_artifact)
            )
        }

        base_size_metrics_map = _fetch_base_size_metrics([head_artifact], self.project)

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute_diff",
            value=5 * 1024 * 1024,
            filter_query="",
        )

        status, triggered_rules = _compute_overall_status(
            [head_artifact],
            size_metrics_map,
            rules=[rule],
            base_size_metrics_map=base_size_metrics_map,
        )
        assert status == StatusCheckStatus.FAILURE
        assert triggered_rules == [rule]

    def test_rules_only_evaluate_main_artifact_not_watch_app(self):
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=self.commit_comparison,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=50 * 1024 * 1024,
        )

        PreprodArtifactSizeMetrics.objects.create(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
            max_install_size=150 * 1024 * 1024,
            identifier="com.example.app.watchapp",
        )

        size_metrics_map = {
            artifact.id: list(PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=artifact))
        }

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="",
        )

        status, triggered_rules = _compute_overall_status(
            [artifact], size_metrics_map, rules=[rule]
        )
        assert status == StatusCheckStatus.SUCCESS
        assert triggered_rules == []

    def test_filters_on_missing_fields_do_not_match(self):
        artifact_no_build_config = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
        )

        context = _get_artifact_filter_context(artifact_no_build_config)
        assert "build_configuration" not in context

        positive_rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="build_configuration:Debug",
        )
        negated_rule = StatusCheckRule(
            id="rule2",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="!build_configuration:Debug",
        )
        negated_in_rule = StatusCheckRule(
            id="rule3",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="!build_configuration:[Debug,Release]",
        )

        assert _rule_matches_artifact(positive_rule, context) is False
        assert _rule_matches_artifact(negated_rule, context) is False
        assert _rule_matches_artifact(negated_in_rule, context) is False

    def test_negated_filters_still_work_when_field_present(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
            build_configuration_id=self.build_config_debug.id,
        )

        context = _get_artifact_filter_context(artifact)

        rule_not_release = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="!build_configuration:Release",
        )
        rule_not_debug = StatusCheckRule(
            id="rule2",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="!build_configuration:Debug",
        )

        assert _rule_matches_artifact(rule_not_release, context) is True
        assert _rule_matches_artifact(rule_not_debug, context) is False

    def test_combined_filters_fail_when_any_field_missing(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app",
            commit_comparison=self.commit_comparison,
        )

        context = _get_artifact_filter_context(artifact)
        assert context["platform"] == "ios"
        assert "build_configuration" not in context

        rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100 * 1024 * 1024,
            filter_query="platform:ios !build_configuration:Debug",
        )

        assert _rule_matches_artifact(rule, context) is False
