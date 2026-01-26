from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import patch

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.commitcomparison import CommitComparison
from sentry.models.repository import Repository
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.vcs.status_checks.size.tasks import APPROVE_SIZE_ACTION_IDENTIFIER
from sentry.preprod.vcs.webhooks.github_check_run import handle_preprod_check_run_event
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class HandlePreprodCheckRunEventTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(
            teams=[self.team], organization=self.organization, name="test_project"
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
        )

    def _create_preprod_artifact(
        self,
        state=PreprodArtifact.ArtifactState.PROCESSED,
        app_id="com.example.app",
    ):
        unique_suffix = str(uuid.uuid4()).replace("-", "")[:8]
        head_sha = unique_suffix.ljust(40, "a")
        base_sha = unique_suffix.ljust(40, "b")

        commit_comparison = CommitComparison.objects.create(
            organization_id=self.organization.id,
            head_sha=head_sha,
            base_sha=base_sha,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=state,
            app_id=app_id,
            commit_comparison=commit_comparison,
        )

        return preprod_artifact

    def _create_webhook_event(
        self,
        action: str,
        identifier: str,
        external_id: str,
        sender_id: int = 12345,
        sender_login: str = "octocat",
    ):
        return {
            "action": action,
            "requested_action": {"identifier": identifier},
            "check_run": {
                "id": 987654321,
                "external_id": external_id,
                "name": "Size Analysis",
                "head_sha": "a" * 40,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "details_url": "https://sentry.io/preprod/artifacts/123/",
                "output": {
                    "title": "1 app analyzed",
                    "summary": "## Test summary",
                },
            },
            "sender": {
                "id": sender_id,
                "login": sender_login,
            },
            "repository": {
                "id": 11111,
                "full_name": "owner/repo",
            },
            "installation": {
                "id": 22222,
            },
        }

    def test_ignores_non_check_run_events(self):
        artifact = self._create_preprod_artifact()
        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id=str(artifact.id),
        )

        handle_preprod_check_run_event(
            github_event=GithubWebhookType.PUSH,
            event=event,
            organization=self.organization,
            repo=self.repo,
        )

        assert (
            PreprodComparisonApproval.objects.filter(
                preprod_artifact__project__organization=self.organization
            ).count()
            == 0
        )

    def test_ignores_non_requested_action(self):
        artifact = self._create_preprod_artifact()
        event = self._create_webhook_event(
            action="completed",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id=str(artifact.id),
        )

        handle_preprod_check_run_event(
            github_event=GithubWebhookType.CHECK_RUN,
            event=event,
            organization=self.organization,
            repo=self.repo,
        )

        assert (
            PreprodComparisonApproval.objects.filter(
                preprod_artifact__project__organization=self.organization
            ).count()
            == 0
        )

    def test_ignores_non_approve_size_identifier(self):
        artifact = self._create_preprod_artifact()
        event = self._create_webhook_event(
            action="requested_action",
            identifier="some_other_action",
            external_id=str(artifact.id),
        )

        handle_preprod_check_run_event(
            github_event=GithubWebhookType.CHECK_RUN,
            event=event,
            organization=self.organization,
            repo=self.repo,
        )

        assert (
            PreprodComparisonApproval.objects.filter(
                preprod_artifact__project__organization=self.organization
            ).count()
            == 0
        )

    def test_creates_approval_for_valid_request(self):
        artifact = self._create_preprod_artifact()
        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id=str(artifact.id),
            sender_id=12345,
            sender_login="octocat",
        )

        with patch(
            "sentry.preprod.vcs.webhooks.github_check_run.create_preprod_status_check_task"
        ) as mock_task:
            handle_preprod_check_run_event(
                github_event=GithubWebhookType.CHECK_RUN,
                event=event,
                organization=self.organization,
                repo=self.repo,
            )

        approvals = PreprodComparisonApproval.objects.filter(preprod_artifact=artifact)
        assert approvals.count() == 1

        approval = approvals.first()
        assert approval is not None
        assert approval.preprod_feature_type == PreprodComparisonApproval.FeatureType.SIZE
        assert approval.approval_status == PreprodComparisonApproval.ApprovalStatus.APPROVED
        assert approval.approved_by_id is None
        assert approval.extras == {"github": {"id": 12345, "login": "octocat"}}
        assert approval.approved_at is not None

        mock_task.apply_async.assert_called_once_with(
            kwargs={
                "preprod_artifact_id": artifact.id,
                "caller": "github_approve_webhook",
            }
        )

    def test_creates_approvals_for_all_sibling_artifacts(self):
        artifact1 = self._create_preprod_artifact(app_id="com.example.app1")
        commit_comparison = artifact1.commit_comparison

        artifact2 = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app2",
            commit_comparison=commit_comparison,
        )

        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id=str(artifact1.id),
        )

        with patch("sentry.preprod.vcs.webhooks.github_check_run.create_preprod_status_check_task"):
            handle_preprod_check_run_event(
                github_event=GithubWebhookType.CHECK_RUN,
                event=event,
                organization=self.organization,
                repo=self.repo,
            )

        assert PreprodComparisonApproval.objects.filter(preprod_artifact=artifact1).exists()
        assert PreprodComparisonApproval.objects.filter(preprod_artifact=artifact2).exists()
        assert (
            PreprodComparisonApproval.objects.filter(
                preprod_artifact__project__organization=self.organization
            ).count()
            == 2
        )

    def test_handles_missing_external_id(self):
        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id="",
        )
        event["check_run"]["external_id"] = None

        handle_preprod_check_run_event(
            github_event=GithubWebhookType.CHECK_RUN,
            event=event,
            organization=self.organization,
            repo=self.repo,
        )

        assert (
            PreprodComparisonApproval.objects.filter(
                preprod_artifact__project__organization=self.organization
            ).count()
            == 0
        )

    def test_handles_invalid_external_id(self):
        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id="not-a-number",
        )

        handle_preprod_check_run_event(
            github_event=GithubWebhookType.CHECK_RUN,
            event=event,
            organization=self.organization,
            repo=self.repo,
        )

        assert (
            PreprodComparisonApproval.objects.filter(
                preprod_artifact__project__organization=self.organization
            ).count()
            == 0
        )

    def test_handles_nonexistent_artifact(self):
        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id="999999999",
        )

        handle_preprod_check_run_event(
            github_event=GithubWebhookType.CHECK_RUN,
            event=event,
            organization=self.organization,
            repo=self.repo,
        )

        assert (
            PreprodComparisonApproval.objects.filter(
                preprod_artifact__project__organization=self.organization
            ).count()
            == 0
        )

    def test_artifact_not_found_for_different_organization(self):
        """Artifact belonging to a different org is not found (org filter is part of query)."""
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org, name="other_project")

        commit_comparison = CommitComparison.objects.create(
            organization_id=other_org.id,
            head_sha="c" * 40,
            base_sha="d" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/test",
            base_ref="main",
        )

        artifact = PreprodArtifact.objects.create(
            project=other_project,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            app_id="com.example.app",
            commit_comparison=commit_comparison,
        )

        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id=str(artifact.id),
        )

        handle_preprod_check_run_event(
            github_event=GithubWebhookType.CHECK_RUN,
            event=event,
            organization=self.organization,
            repo=self.repo,
        )

        assert (
            PreprodComparisonApproval.objects.filter(
                preprod_artifact__project__organization=self.organization
            ).count()
            == 0
        )

    def test_skips_duplicate_approval_from_same_user(self):
        """Same GitHub user clicking approve twice should not create duplicate."""
        artifact = self._create_preprod_artifact()

        # Create existing approval from user 12345
        PreprodComparisonApproval.objects.create(
            preprod_artifact=artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SIZE,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            approved_at=datetime.now(timezone.utc),
            extras={"github": {"id": 12345, "login": "octocat"}},
        )

        # Webhook from the same user (12345)
        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id=str(artifact.id),
            sender_id=12345,
            sender_login="octocat",
        )

        with patch("sentry.preprod.vcs.webhooks.github_check_run.create_preprod_status_check_task"):
            handle_preprod_check_run_event(
                github_event=GithubWebhookType.CHECK_RUN,
                event=event,
                organization=self.organization,
                repo=self.repo,
            )

        # Should still be 1 (no duplicate created)
        assert PreprodComparisonApproval.objects.filter(preprod_artifact=artifact).count() == 1

    def test_allows_different_user_to_create_new_approval(self):
        """Different GitHub user approving should create a new approval record."""
        artifact = self._create_preprod_artifact()

        # Create existing approval from user 11111
        PreprodComparisonApproval.objects.create(
            preprod_artifact=artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SIZE,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            approved_at=datetime.now(timezone.utc),
            extras={"github": {"id": 11111, "login": "existing_user"}},
        )

        # Webhook from a different user (12345)
        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id=str(artifact.id),
            sender_id=12345,
            sender_login="octocat",
        )

        with patch("sentry.preprod.vcs.webhooks.github_check_run.create_preprod_status_check_task"):
            handle_preprod_check_run_event(
                github_event=GithubWebhookType.CHECK_RUN,
                event=event,
                organization=self.organization,
                repo=self.repo,
            )

        # Should be 2 (different user creates new approval)
        assert PreprodComparisonApproval.objects.filter(preprod_artifact=artifact).count() == 2

        # Verify the new approval has the correct user info
        latest_approval = (
            PreprodComparisonApproval.objects.filter(preprod_artifact=artifact)
            .order_by("-id")
            .first()
        )
        assert latest_approval is not None
        assert latest_approval.extras == {"github": {"id": 12345, "login": "octocat"}}

    def test_checks_latest_approval_not_first(self):
        """When multiple approvals exist, check against the latest one, not the first."""
        artifact = self._create_preprod_artifact()

        # User A approves first
        PreprodComparisonApproval.objects.create(
            preprod_artifact=artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SIZE,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            approved_at=datetime.now(timezone.utc),
            extras={"github": {"id": 11111, "login": "user_a"}},
        )

        # User B approves second (this is now the latest)
        PreprodComparisonApproval.objects.create(
            preprod_artifact=artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SIZE,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            approved_at=datetime.now(timezone.utc),
            extras={"github": {"id": 22222, "login": "user_b"}},
        )

        # User A tries again - should succeed since latest approval is from B, not A
        event = self._create_webhook_event(
            action="requested_action",
            identifier=APPROVE_SIZE_ACTION_IDENTIFIER,
            external_id=str(artifact.id),
            sender_id=11111,
            sender_login="user_a",
        )

        with patch("sentry.preprod.vcs.webhooks.github_check_run.create_preprod_status_check_task"):
            handle_preprod_check_run_event(
                github_event=GithubWebhookType.CHECK_RUN,
                event=event,
                organization=self.organization,
                repo=self.repo,
            )

        # Should be 3 approvals now (A, B, then A again)
        assert PreprodComparisonApproval.objects.filter(preprod_artifact=artifact).count() == 3
