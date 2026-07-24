from __future__ import annotations

from typing import cast
from unittest.mock import Mock, patch

import pytest

from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.vcs.status_checks.size.tasks import SizeEvaluation
from sentry.preprod.vcs.status_checks.size.types import StatusCheckRule, TriggeredRule
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test

FEATURE = "organizations:preprod-size-analysis-pr-comments"
ENABLED_OPTION_KEY = "sentry:preprod_size_pr_comments_enabled"
RULES_OPTION_KEY = "sentry:preprod_size_pr_comments_rules"

# A single valid rule; its contents don't matter when evaluate is patched, only
# that get_status_check_rules parses a non-empty list from the option.
_RULES_JSON = '[{"id": "rule1", "metric": "install_size", "measurement": "absolute", "value": 1}]'

_EVAL_PATH = "sentry.preprod.vcs.pr_comments.size_tasks.evaluate_size_and_format_messages"
_CLIENT_PATH = "sentry.preprod.vcs.pr_comments.size_tasks.get_commit_context_client"


def _eval_result(
    *,
    triggered: bool,
    status: StatusCheckStatus = StatusCheckStatus.SUCCESS,
    title: str = "Size Analysis",
    subtitle: str = "1 component analyzed",
    summary: str = "size summary body",
    evaluated_artifacts: list[PreprodArtifact] | None = None,
) -> SizeEvaluation:
    """Build a return value matching evaluate_size_and_format_messages."""
    triggered_rules: list[TriggeredRule] = []
    if triggered:
        rule = StatusCheckRule(id="rule1", metric="install_size", measurement="absolute", value=1)
        triggered_rules = [
            TriggeredRule(rule=rule, artifact_id=1, app_id="com.example.app", platform="ios")
        ]
    if evaluated_artifacts is None:
        # Contents are irrelevant; the task only checks whether the list is non-empty.
        evaluated_artifacts = [cast(PreprodArtifact, object())]
    return SizeEvaluation(
        status=status,
        triggered_rules=triggered_rules,
        title=title,
        subtitle=subtitle,
        summary=summary,
        evaluated_artifacts=evaluated_artifacts,
    )


@cell_silo_test
@with_feature(FEATURE)
class CreatePreprodSizePrCommentTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )

    def _create_artifact(
        self,
        with_commit_comparison=True,
        pr_number=42,
        provider="github",
        app_id="com.example.app",
        commit_comparison=None,
    ) -> PreprodArtifact:
        if with_commit_comparison and commit_comparison is None:
            commit_comparison = self.create_commit_comparison(
                organization=self.organization,
                provider=provider,
                pr_number=pr_number,
            )
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id=app_id,
            commit_comparison=commit_comparison,
        )
        return PreprodArtifact.objects.select_related(
            "mobile_app_info",
            "build_configuration",
            "commit_comparison",
            "project",
            "project__organization",
        ).get(id=artifact.id)

    def _enable(self) -> None:
        self.project.update_option(ENABLED_OPTION_KEY, True)

    def _set_rules(self, raw: str = _RULES_JSON) -> None:
        self.project.update_option(RULES_OPTION_KEY, raw)

    def _import_task(self):
        from sentry.preprod.vcs.pr_comments.size_tasks import create_preprod_size_pr_comment_task

        return create_preprod_size_pr_comment_task

    # --- create / update / skip gate ------------------------------------

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_creates_comment_when_rule_triggered(self, mock_eval, mock_get_client) -> None:
        mock_client = Mock()
        mock_client.create_comment.return_value = {"id": 55555}
        mock_get_client.return_value = mock_client
        mock_eval.return_value = _eval_result(triggered=True)

        self._enable()
        self._set_rules()
        artifact = self._create_artifact()

        self._import_task()(artifact.id)

        mock_client.create_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            data={"body": "## Size Analysis\n\n1 component analyzed\n\nsize summary body"},
        )
        mock_client.update_comment.assert_not_called()

        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        size = artifact.commit_comparison.extras["pr_comments"]["size"]
        assert size["success"] is True
        assert size["comment_id"] == "55555"

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_creates_comment_when_no_rules_configured(self, mock_eval, mock_get_client) -> None:
        mock_client = Mock()
        mock_client.create_comment.return_value = {"id": 1}
        mock_get_client.return_value = mock_client
        mock_eval.return_value = _eval_result(triggered=False, status=StatusCheckStatus.NEUTRAL)

        self._enable()
        # No rules option set -> get_status_check_rules returns []
        artifact = self._create_artifact()

        self._import_task()(artifact.id)

        mock_client.create_comment.assert_called_once()
        mock_client.update_comment.assert_not_called()

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_skips_when_rules_set_but_nothing_triggered(self, mock_eval, mock_get_client) -> None:
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_eval.return_value = _eval_result(triggered=False)

        self._enable()
        self._set_rules()
        artifact = self._create_artifact()

        self._import_task()(artifact.id)

        mock_client.create_comment.assert_not_called()
        mock_client.update_comment.assert_not_called()

        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        assert (artifact.commit_comparison.extras or {}).get("pr_comments") is None

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_updates_existing_comment_even_without_trigger(
        self, mock_eval, mock_get_client
    ) -> None:
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_eval.return_value = _eval_result(triggered=False)

        commit_comparison = self.create_commit_comparison(
            organization=self.organization, provider="github", pr_number=42
        )
        commit_comparison.extras = {
            "pr_comments": {"size": {"success": True, "comment_id": "existing_777"}}
        }
        commit_comparison.save(update_fields=["extras"])

        self._enable()
        self._set_rules()
        artifact = self._create_artifact(commit_comparison=commit_comparison)

        self._import_task()(artifact.id)

        mock_client.update_comment.assert_called_once_with(
            repo="owner/repo",
            issue_id="42",
            comment_id="existing_777",
            data={"body": "## Size Analysis\n\n1 component analyzed\n\nsize summary body"},
        )
        mock_client.create_comment.assert_not_called()

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_skips_when_no_size_artifacts(self, mock_eval, mock_get_client) -> None:
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        # No evaluated artifacts: every sibling was skipped or had no size metrics.
        mock_eval.return_value = _eval_result(
            triggered=False, status=StatusCheckStatus.NEUTRAL, evaluated_artifacts=[]
        )

        self._enable()
        self._set_rules()
        artifact = self._create_artifact()

        self._import_task()(artifact.id)

        mock_client.create_comment.assert_not_called()
        mock_client.update_comment.assert_not_called()

        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        assert (artifact.commit_comparison.extras or {}).get("pr_comments") is None

    # --- early-return skips ---------------------------------------------

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_skips_when_project_option_disabled(self, mock_eval, mock_get_client) -> None:
        artifact = self._create_artifact()

        self._import_task()(artifact.id)

        mock_get_client.assert_not_called()
        mock_eval.assert_not_called()

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_skips_when_no_commit_comparison(self, mock_eval, mock_get_client) -> None:
        self._enable()
        artifact = self._create_artifact(with_commit_comparison=False)

        self._import_task()(artifact.id)

        mock_get_client.assert_not_called()

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_skips_when_no_pr_number(self, mock_eval, mock_get_client) -> None:
        self._enable()
        commit_comparison = self.create_commit_comparison(
            organization=self.organization, provider="github", pr_number=None
        )
        artifact = self._create_artifact(commit_comparison=commit_comparison)

        self._import_task()(artifact.id)

        mock_get_client.assert_not_called()

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_skips_when_no_client(self, mock_eval, mock_get_client) -> None:
        mock_get_client.return_value = None
        self._enable()
        self._set_rules()
        artifact = self._create_artifact()

        self._import_task()(artifact.id)

        mock_eval.assert_not_called()

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_skips_when_feature_flag_disabled(self, mock_eval, mock_get_client) -> None:
        self._enable()
        self._set_rules()
        artifact = self._create_artifact()

        with self.feature({FEATURE: False}):
            self._import_task()(artifact.id)

        mock_get_client.assert_not_called()
        mock_eval.assert_not_called()

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_skips_nonexistent_artifact(self, mock_eval, mock_get_client) -> None:
        self._import_task()(1234567)

        mock_get_client.assert_not_called()

    # --- error handling / retry -----------------------------------------

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_handles_api_error_and_reraises(self, mock_eval, mock_get_client) -> None:
        mock_client = Mock()
        mock_client.create_comment.side_effect = ApiError("boom", code=500)
        mock_get_client.return_value = mock_client
        mock_eval.return_value = _eval_result(triggered=True)

        self._enable()
        self._set_rules()
        artifact = self._create_artifact()

        with pytest.raises(ApiError):
            self._import_task()(artifact.id)

        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        size = artifact.commit_comparison.extras["pr_comments"]["size"]
        assert size["success"] is False
        assert size["error_type"] == "api_error"
        assert "comment_id" not in size

    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_retry_after_update_failure_uses_update_not_create(
        self, mock_eval, mock_get_client
    ) -> None:
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_eval.return_value = _eval_result(triggered=True)

        commit_comparison = self.create_commit_comparison(
            organization=self.organization, provider="github", pr_number=42
        )
        commit_comparison.extras = {
            "pr_comments": {"size": {"success": False, "comment_id": "existing_777"}}
        }
        commit_comparison.save(update_fields=["extras"])

        self._enable()
        self._set_rules()
        artifact = self._create_artifact(commit_comparison=commit_comparison)

        self._import_task()(artifact.id)

        mock_client.update_comment.assert_called_once()
        mock_client.create_comment.assert_not_called()

    @patch("sentry.preprod.vcs.pr_comments.size_tasks.lock_pr_comparisons_for_update")
    @patch(_CLIENT_PATH)
    @patch(_EVAL_PATH)
    def test_returns_without_retry_when_commit_comparison_deleted(
        self, mock_eval, mock_get_client, mock_lock
    ) -> None:
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_eval.return_value = _eval_result(triggered=True)
        mock_lock.side_effect = CommitComparison.DoesNotExist()

        self._enable()
        self._set_rules()
        artifact = self._create_artifact()

        self._import_task()(artifact.id)

        mock_lock.assert_called_once()
        mock_client.create_comment.assert_not_called()
        mock_client.update_comment.assert_not_called()

    # --- end-to-end (real evaluation, unpatched) ------------------------

    @patch(_CLIENT_PATH)
    def test_end_to_end_triggering_rule_creates_comment(self, mock_get_client) -> None:
        mock_client = Mock()
        mock_client.create_comment.return_value = {"id": 314}
        mock_get_client.return_value = mock_client

        self._enable()
        # install_size absolute >= 100MB; head build is 150MB -> triggers.
        self._set_rules(
            '[{"id": "r1", "metric": "install_size", "measurement": "absolute", '
            '"value": 104857600}]'
        )
        artifact = self._create_artifact()
        self.create_preprod_artifact_size_metrics(
            preprod_artifact=artifact,
            min_install_size=150 * 1024 * 1024,
            max_install_size=150 * 1024 * 1024,
        )

        self._import_task()(artifact.id)

        mock_client.create_comment.assert_called_once()
        body = mock_client.create_comment.call_args.kwargs["data"]["body"]
        assert body.startswith("## Size Analysis")

        assert artifact.commit_comparison is not None
        artifact.commit_comparison.refresh_from_db()
        assert artifact.commit_comparison.extras["pr_comments"]["size"]["comment_id"] == "314"

    def test_commit_comparison_extras_isolated_from_status_check(self) -> None:
        # Sanity: the "size" comment key is independent of build_distribution/snapshots.
        cc = self.create_commit_comparison(organization=self.organization, pr_number=42)
        assert isinstance(cc, CommitComparison)
        assert (cc.extras or {}).get("pr_comments") is None
