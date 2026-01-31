from unittest.mock import patch

import responses

from fixtures.gitlab import GitLabTestCase
from sentry.constants import ObjectStatus
from sentry.integrations.gitlab.metrics import GitLabWebhookUpdateHaltReason
from sentry.integrations.gitlab.tasks import update_all_project_webhooks, update_project_webhook
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_slo_metric
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class UpdateAllProjectWebhooksTest(GitLabTestCase):
    """Tests for the main orchestration task that spawns individual webhook update tasks"""

    def setUp(self):
        super().setUp()
        # Create repositories with webhook config
        with assume_test_silo_mode(SiloMode.REGION):
            self.repo1 = self.create_gitlab_repo(
                name="test-repo-1",
                external_id=101,
            )
            self.repo1.config = {
                "project_id": "101",
                "webhook_id": "webhook-1",
                "path": "test-group/repo1",
            }
            self.repo1.save()

            self.repo2 = self.create_gitlab_repo(
                name="test-repo-2",
                external_id=102,
            )
            self.repo2.config = {
                "project_id": "102",
                "webhook_id": "webhook-2",
                "path": "test-group/repo2",
            }
            self.repo2.save()

            self.repo3 = self.create_gitlab_repo(
                name="test-repo-3",
                external_id=103,
            )
            self.repo3.config = {
                "project_id": "103",
                "webhook_id": "webhook-3",
                "path": "test-group/repo3",
            }
            self.repo3.save()

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_spawns_individual_tasks(self, mock_delay, mock_record_event):
        """Test that the task spawns individual tasks for each repository"""
        update_all_project_webhooks(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        # Verify individual tasks were spawned for each repository
        assert mock_delay.call_count == 3

        # Verify the correct arguments were passed to each task
        spawned_repo_ids = {call[0][2] for call in mock_delay.call_args_list}
        expected_repo_ids = {self.repo1.id, self.repo2.id, self.repo3.id}
        assert spawned_repo_ids == expected_repo_ids

        # Verify SLO metrics were recorded
        assert mock_record_event.call_count >= 2
        # First call should be STARTED
        assert mock_record_event.call_args_list[0][0][0] == EventLifecycleOutcome.STARTED
        # Last call should be SUCCESS
        assert mock_record_event.call_args_list[-1][0][0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_handles_integration_not_found(self, mock_delay, mock_record_event):
        """Test that the task handles missing integration gracefully"""
        # Should not raise exception and no tasks should be spawned
        update_all_project_webhooks(
            integration_id=99999,
            organization_id=self.organization.id,
        )

        assert mock_delay.call_count == 0
        # No metrics should be recorded when integration is not found (early return)
        assert mock_record_event.call_count == 0

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_handles_no_repositories(self, mock_delay, mock_record_event):
        """Test that the task handles case with no repositories and records halt metric"""
        # Delete all repositories
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.filter(integration_id=self.integration.id).delete()

        update_all_project_webhooks(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        # No tasks should be spawned
        assert mock_delay.call_count == 0

        # Verify SLO halt metric was recorded
        assert mock_record_event.call_count >= 2
        assert mock_record_event.call_args_list[0][0][0] == EventLifecycleOutcome.STARTED
        # Last call should be HALTED with NO_REPOSITORIES reason
        last_call = mock_record_event.call_args_list[-1]
        assert last_call[0][0] == EventLifecycleOutcome.HALTED
        assert last_call[0][1] == GitLabWebhookUpdateHaltReason.NO_REPOSITORIES

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_handles_org_integration_not_found(self, mock_delay, mock_record_event):
        """Test that the task handles missing org integration"""
        with assume_test_silo_mode(SiloMode.CONTROL):
            # Delete org integration
            self.integration.organizationintegration_set.filter(
                organization_id=self.organization.id
            ).delete()

        update_all_project_webhooks(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        # No tasks should be spawned
        assert mock_delay.call_count == 0

        # Verify SLO halt metric was recorded
        assert mock_record_event.call_count >= 2
        assert mock_record_event.call_args_list[0][0][0] == EventLifecycleOutcome.STARTED
        # Last call should be HALTED with ORG_INTEGRATION_NOT_FOUND reason
        last_call = mock_record_event.call_args_list[-1]
        assert last_call[0][0] == EventLifecycleOutcome.HALTED
        assert last_call[0][1] == GitLabWebhookUpdateHaltReason.ORG_INTEGRATION_NOT_FOUND

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_skips_repositories_missing_webhook_config(self, mock_delay, mock_record_event):
        """Test that the task spawns tasks for all repos - filtering happens in individual tasks"""
        with assume_test_silo_mode(SiloMode.REGION):
            # Repository missing webhook_id
            repo_no_webhook = self.create_gitlab_repo(
                name="repo-no-webhook",
                external_id=104,
            )
            repo_no_webhook.config = {"project_id": "104"}
            repo_no_webhook.save()

            # Repository missing project_id
            repo_no_project = self.create_gitlab_repo(
                name="repo-no-project",
                external_id=105,
            )
            repo_no_project.config = {"webhook_id": "webhook-5"}
            repo_no_project.save()

        update_all_project_webhooks(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        # Tasks are spawned for all repositories - filtering happens in individual tasks
        assert mock_delay.call_count == 5

        # Verify all repos had tasks spawned
        spawned_repo_ids = {call[0][2] for call in mock_delay.call_args_list}
        assert spawned_repo_ids == {
            self.repo1.id,
            self.repo2.id,
            self.repo3.id,
            repo_no_webhook.id,
            repo_no_project.id,
        }

        # Verify SLO metrics were recorded - orchestration task succeeds
        assert_slo_metric(mock_record_event)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_only_processes_active_repositories(self, mock_delay, mock_record_event):
        """Test that only active repositories are processed"""
        with assume_test_silo_mode(SiloMode.REGION):
            # Mark one repository as inactive
            self.repo2.status = ObjectStatus.DISABLED
            self.repo2.save()

        update_all_project_webhooks(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        # Only active repositories should have tasks spawned (2 out of 3)
        assert mock_delay.call_count == 2

        # Verify only active repos had tasks spawned
        spawned_repo_ids = {call[0][2] for call in mock_delay.call_args_list}
        assert spawned_repo_ids == {self.repo1.id, self.repo3.id}

        # Verify SLO metrics were recorded - task succeeds with active repos
        assert_slo_metric(mock_record_event)


@region_silo_test
class UpdateProjectWebhookTest(GitLabTestCase):
    """Tests for the individual webhook update task"""

    def setUp(self):
        super().setUp()
        with assume_test_silo_mode(SiloMode.REGION):
            self.repo = self.create_gitlab_repo(
                name="test-repo",
                external_id=101,
            )
            self.repo.config = {
                "project_id": "101",
                "webhook_id": "webhook-1",
                "path": "test-group/repo",
            }
            self.repo.save()

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_updates_webhook(self, mock_record_event):
        """Test that the task successfully updates a webhook"""
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"id": "webhook-1"},
            status=200,
        )

        update_project_webhook(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        # Verify webhook was updated
        assert len(responses.calls) == 1
        assert "101" in responses.calls[0].request.url
        assert "webhook-1" in responses.calls[0].request.url

        # Verify SLO metrics were recorded
        assert_slo_metric(mock_record_event)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_handles_integration_not_found(self, mock_record_event):
        """Test that the task handles missing integration gracefully"""
        update_project_webhook(
            integration_id=99999,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        # No API calls should be made
        assert len(responses.calls) == 0

        # No metrics should be recorded when integration is not found (early return)
        assert mock_record_event.call_count == 0

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_handles_repository_not_found(self, mock_record_event):
        """Test that the task handles missing repository gracefully"""
        update_project_webhook(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            repository_id=99999,
        )

        # No API calls should be made
        assert len(responses.calls) == 0

        # Verify SLO halt metric was recorded
        assert mock_record_event.call_count >= 2
        assert mock_record_event.call_args_list[0][0][0] == EventLifecycleOutcome.STARTED
        # Last call should be HALTED with REPOSITORY_NOT_FOUND reason
        last_call = mock_record_event.call_args_list[-1]
        assert last_call[0][0] == EventLifecycleOutcome.HALTED
        assert last_call[0][1] == GitLabWebhookUpdateHaltReason.REPOSITORY_NOT_FOUND

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_handles_inactive_repository(self, mock_record_event):
        """Test that the task handles inactive repositories"""
        with assume_test_silo_mode(SiloMode.REGION):
            self.repo.status = ObjectStatus.DISABLED
            self.repo.save()

        update_project_webhook(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        # No API calls should be made for inactive repos
        assert len(responses.calls) == 0

        # Verify SLO halt metric was recorded (inactive = not found in query)
        assert mock_record_event.call_count >= 2
        assert mock_record_event.call_args_list[0][0][0] == EventLifecycleOutcome.STARTED
        # Last call should be HALTED with REPOSITORY_NOT_FOUND reason
        last_call = mock_record_event.call_args_list[-1]
        assert last_call[0][0] == EventLifecycleOutcome.HALTED
        assert last_call[0][1] == GitLabWebhookUpdateHaltReason.REPOSITORY_NOT_FOUND

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_handles_missing_webhook_config(self, mock_record_event):
        """Test that the task handles repositories without webhook configuration"""
        with assume_test_silo_mode(SiloMode.REGION):
            self.repo.config = {"project_id": "101"}  # Missing webhook_id
            self.repo.save()

        update_project_webhook(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        # No API calls should be made
        assert len(responses.calls) == 0

        # Verify SLO halt metric was recorded
        assert mock_record_event.call_count >= 2
        assert mock_record_event.call_args_list[0][0][0] == EventLifecycleOutcome.STARTED
        # Last call should be HALTED with MISSING_WEBHOOK_CONFIG reason
        last_call = mock_record_event.call_args_list[-1]
        assert last_call[0][0] == EventLifecycleOutcome.HALTED
        assert last_call[0][1] == GitLabWebhookUpdateHaltReason.MISSING_WEBHOOK_CONFIG

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_retries_on_failure(self, mock_record_event):
        """Test that the task retries on API failures"""
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"error": "Server error"},
            status=500,
        )

        # The task should raise an exception which triggers retry
        try:
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )
        except Exception:
            pass  # Expected to fail

        # Verify API call was attempted
        assert len(responses.calls) == 1

        # Verify SLO failure metric was recorded
        assert_slo_metric(mock_record_event, event_outcome=EventLifecycleOutcome.FAILURE)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_updates_webhook_with_correct_data(self, mock_record_event):
        """Test that webhook update includes correct event subscriptions"""
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"id": "webhook-1"},
            status=200,
        )

        update_project_webhook(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        # Verify the webhook update includes correct data
        assert len(responses.calls) == 1
        request_body = responses.calls[0].request.body

        # The update should include issues_events, merge_requests_events, and push_events
        assert b"merge_requests_events" in request_body
        assert b"push_events" in request_body
        assert b"issues_events" in request_body

        # Verify SLO metrics were recorded
        assert_slo_metric(mock_record_event)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_logs_success(self, mock_record_event):
        """Test that the task logs successful updates"""
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"id": "webhook-1"},
            status=200,
        )

        with patch("sentry.integrations.gitlab.tasks.logger") as mock_logger:
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )

            # Verify success was logged
            mock_logger.info.assert_called_once_with(
                "update-project-webhook.webhook-updated",
                extra={
                    "repository_id": self.repo.id,
                    "repository_name": self.repo.name,
                    "project_id": "101",
                    "webhook_id": "webhook-1",
                },
            )

        # Verify SLO metrics were recorded
        assert_slo_metric(mock_record_event)
