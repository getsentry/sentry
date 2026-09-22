from unittest.mock import call, patch

import pytest
import responses
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import RedisError
from redis.exceptions import TimeoutError as RedisTimeoutError

from fixtures.gitlab import GitLabTestCase
from sentry.constants import ObjectStatus
from sentry.integrations.gitlab.metrics import GitLabWebhookUpdateHaltReason
from sentry.integrations.gitlab.tasks import update_all_project_webhooks, update_project_webhook
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_slo_metric
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test
from sentry.utils.redis import redis_clusters


@cell_silo_test
class UpdateAllProjectWebhooksTest(GitLabTestCase):
    """Tests for the main orchestration task that spawns individual webhook update tasks"""

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_debounce_has_ttl_and_force_bypasses_it(self, mock_delay):
        kwargs = {"integration_id": self.integration.id, "organization_id": self.organization.id}
        org_integration = integration_service.get_organization_integration(**kwargs)
        assert org_integration is not None
        config = org_integration.config.copy()

        update_all_project_webhooks(**kwargs)
        assert mock_delay.call_count == 3
        update_all_project_webhooks(**kwargs)
        assert mock_delay.call_count == 3
        update_all_project_webhooks(**kwargs, force=True)
        assert mock_delay.call_count == 6
        update_all_project_webhooks(**kwargs)
        assert mock_delay.call_count == 6

        key = f"gitlab:webhook-reconcile:{self.organization.id}:{self.integration.id}"
        redis = redis_clusters.get("default")
        assert 0 < redis.ttl(key) <= 600
        redis.delete(key)
        update_all_project_webhooks(**kwargs)
        assert mock_delay.call_count == 9
        refreshed = integration_service.get_organization_integration(**kwargs)
        assert refreshed is not None
        assert refreshed.config == config

    def test_redis_connection_error_does_not_block_reconciliation(self):
        self.assert_reconciliation_without_debounce(RedisConnectionError("Redis unavailable"))

    def test_redis_timeout_does_not_block_forced_reconciliation(self):
        self.assert_reconciliation_without_debounce(
            RedisTimeoutError("Redis timed out"), force=True
        )

    def assert_reconciliation_without_debounce(self, error: RedisError, force: bool = False):
        with (
            patch("sentry.integrations.gitlab.tasks.redis_clusters") as clusters,
            patch("sentry.integrations.gitlab.tasks.logger.exception") as log_exception,
            patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay") as delay,
            patch("sentry.integrations.gitlab.tasks.release_debounce") as release,
        ):
            clusters.get.return_value.set.side_effect = error
            update_all_project_webhooks(self.integration.id, self.organization.id, force=force)
        assert delay.call_args_list == [
            call(self.integration.id, self.organization.id, self.repo1.id),
            call(self.integration.id, self.organization.id, self.repo2.id),
            call(self.integration.id, self.organization.id, self.repo3.id),
        ]
        release.assert_not_called()
        log_exception.assert_called_once_with(
            "update-all-project-webhooks.debounce-unavailable",
            extra={"integration_id": self.integration.id, "organization_id": self.organization.id},
        )

    def test_fanout_failure_still_raises_when_debounce_is_unavailable(self):
        with (
            patch("sentry.integrations.gitlab.tasks.redis_clusters") as clusters,
            patch("sentry.integrations.gitlab.tasks.logger.exception"),
            patch(
                "sentry.integrations.gitlab.tasks.update_project_webhook.delay",
                side_effect=RuntimeError("Task broker unavailable"),
            ),
        ):
            clusters.get.return_value.set.side_effect = RedisConnectionError("Redis unavailable")
            with pytest.raises(RuntimeError, match="Task broker unavailable"):
                update_all_project_webhooks(self.integration.id, self.organization.id)

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_failed_fanout_can_retry_immediately(self, mock_delay):
        mock_delay.side_effect = RuntimeError("Task broker unavailable")
        with pytest.raises(RuntimeError, match="Task broker unavailable"):
            update_all_project_webhooks(self.integration.id, self.organization.id)

        mock_delay.reset_mock(side_effect=True)
        update_all_project_webhooks(self.integration.id, self.organization.id)
        assert mock_delay.call_count == 3

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_debounced_run_does_not_load_repositories(self, mock_delay):
        update_all_project_webhooks(self.integration.id, self.organization.id)
        mock_delay.reset_mock()
        with patch(
            "sentry.integrations.gitlab.tasks.repository_service.get_repositories"
        ) as get_repositories:
            update_all_project_webhooks(self.integration.id, self.organization.id)
        get_repositories.assert_not_called()
        mock_delay.assert_not_called()

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_repository_lookup_failure_can_retry_immediately(self, mock_delay):
        with patch(
            "sentry.integrations.gitlab.tasks.repository_service.get_repositories",
            side_effect=RuntimeError("Repository service unavailable"),
        ):
            with pytest.raises(RuntimeError, match="Repository service unavailable"):
                update_all_project_webhooks(self.integration.id, self.organization.id)
        update_all_project_webhooks(self.integration.id, self.organization.id)
        assert mock_delay.call_count == 3

    def test_failed_run_does_not_clear_a_newer_debounce(self):
        key = f"gitlab:webhook-reconcile:{self.organization.id}:{self.integration.id}"
        redis = redis_clusters.get("default")

        def fail_after_debounce_was_replaced(*args):
            # Simulate a newer run claiming the key after this run's TTL elapsed.
            redis.set(key, "newer-run", ex=600)
            raise RuntimeError("Task broker unavailable")

        with patch(
            "sentry.integrations.gitlab.tasks.update_project_webhook.delay",
            side_effect=fail_after_debounce_was_replaced,
        ):
            with pytest.raises(RuntimeError, match="Task broker unavailable"):
                update_all_project_webhooks(self.integration.id, self.organization.id)
        assert redis.get(key) == "newer-run"

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_forced_failure_preserves_existing_debounce(self, mock_delay):
        update_all_project_webhooks(self.integration.id, self.organization.id)
        key = f"gitlab:webhook-reconcile:{self.organization.id}:{self.integration.id}"
        redis = redis_clusters.get("default")
        token = redis.get(key)
        mock_delay.side_effect = RuntimeError("Task broker unavailable")
        with pytest.raises(RuntimeError, match="Task broker unavailable"):
            update_all_project_webhooks(self.integration.id, self.organization.id, force=True)
        assert redis.get(key) == token

    def test_debounce_cleanup_failure_preserves_original_error(self):
        with (
            patch(
                "sentry.integrations.gitlab.tasks.update_project_webhook.delay",
                side_effect=RuntimeError("Task broker unavailable"),
            ),
            patch(
                "sentry.integrations.gitlab.tasks.release_debounce",
                side_effect=RedisError("Redis unavailable"),
            ),
            patch("sentry.integrations.gitlab.tasks.logger.exception") as log_exception,
        ):
            with pytest.raises(RuntimeError, match="Task broker unavailable"):
                update_all_project_webhooks(self.integration.id, self.organization.id)
        log_exception.assert_called_once_with(
            "update-all-project-webhooks.debounce-release-failed",
            extra={"integration_id": self.integration.id, "organization_id": self.organization.id},
        )

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_debounce_is_scoped_to_organization_and_integration(self, mock_delay):
        other_org = self.create_organization()
        self.create_organization_integration(
            organization_id=other_org.id, integration=self.integration
        )
        other_repo = self.create_gitlab_repo(
            name="other-org-repo", external_id=104, organization_id=other_org.id
        )
        other_integration = self.create_integration(
            organization=self.organization, provider="gitlab", external_id="other-group"
        )
        self.repo3.update(integration_id=other_integration.id)

        update_all_project_webhooks(self.integration.id, self.organization.id)
        update_all_project_webhooks(self.integration.id, other_org.id)
        update_all_project_webhooks(other_integration.id, self.organization.id)

        assert mock_delay.call_args_list == [
            call(self.integration.id, self.organization.id, self.repo1.id),
            call(self.integration.id, self.organization.id, self.repo2.id),
            call(self.integration.id, other_org.id, other_repo.id),
            call(other_integration.id, self.organization.id, self.repo3.id),
        ]

    def setUp(self) -> None:
        super().setUp()
        # Create repositories with webhook config
        with assume_test_silo_mode(SiloMode.CELL):
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

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_only_updates_active_repositories_for_installing_organization(self, mock_delay):
        other_org = self.create_organization()
        other_integration = self.create_provider_integration(provider="gitlab", external_id="other")
        with assume_test_silo_mode(SiloMode.CELL):
            self.repo2.update(status=ObjectStatus.DISABLED)
            self.repo3.update(integration_id=other_integration.id)
            self.create_gitlab_repo(
                name="other-org-repo", external_id=104, organization_id=other_org.id
            )

        update_all_project_webhooks(
            integration_id=self.integration.id, organization_id=self.organization.id
        )

        assert mock_delay.call_args_list == [
            call(self.integration.id, self.organization.id, self.repo1.id)
        ]

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_handles_no_repositories(self, mock_delay, mock_record_event):
        """Test that the task handles case with no repositories and records halt metric"""
        # Delete all repositories
        with assume_test_silo_mode(SiloMode.CELL):
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
        with assume_test_silo_mode(SiloMode.CELL):
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
        with assume_test_silo_mode(SiloMode.CELL):
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


@cell_silo_test
class UpdateProjectWebhookTest(GitLabTestCase):
    """Tests for the individual webhook update task"""

    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CELL):
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
        with assume_test_silo_mode(SiloMode.CELL):
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
    def test_task_handles_missing_project_id(self, mock_record_event):
        """Test that the task handles repositories without webhook configuration"""
        with assume_test_silo_mode(SiloMode.CELL):
            self.repo.config = {"webhook_id": "webhook-1"}
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
        with pytest.raises(ApiError):
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )

        # Verify API call was attempted
        assert len(responses.calls) == 1

        # Verify SLO failure metric was recorded
        assert_slo_metric(mock_record_event, event_outcome=EventLifecycleOutcome.FAILURE)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_handles_auth_errors(self, mock_record_event):
        """Test that the task retries on API failures"""
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"error": "Unauthorized"},
            status=401,
        )

        # This should fail, but not raise as the exception is swallowed.
        update_project_webhook(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        # Verify API call was attempted
        assert len(responses.calls) == 1

        # Verify SLO halted metric was recorded
        assert_slo_metric(mock_record_event, event_outcome=EventLifecycleOutcome.HALTED)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_handles_not_found_errors(self, mock_record_event):
        """Test that the task retries on API failures"""
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"error": "Not Found"},
            status=404,
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            json={"error": "Not Found"},
            status=404,
        )

        # This should fail, but not raise as the exception is swallowed.
        update_project_webhook(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        # Verify API call was attempted
        assert [call.request.method for call in responses.calls] == ["PUT", "POST"]

        # Verify SLO failure metric was recorded
        assert_slo_metric(mock_record_event, event_outcome=EventLifecycleOutcome.FAILURE)

    @responses.activate
    def test_task_creates_missing_webhook(self):
        self.repo.update(config={"project_id": "101", "path": "test-group/repo"})
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            json={"id": 100},
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        self.repo.refresh_from_db()
        assert self.repo.config == {
            "project_id": "101",
            "path": "test-group/repo",
            "webhook_id": 100,
        }
        assert [call.request.method for call in responses.calls] == ["POST"]

    @responses.activate
    def test_task_recreates_stale_webhook(self):
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            status=404,
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            json={"id": 100},
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 100
        assert [call.request.method for call in responses.calls] == ["PUT", "POST"]

    @responses.activate
    def test_task_replaces_disabled_webhook(self):
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"id": "webhook-1", "alert_status": "disabled"},
        )
        responses.add(
            responses.DELETE,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            status=204,
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            json={"id": 100},
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 100
        assert [call.request.method for call in responses.calls] == ["PUT", "DELETE", "POST"]

    @responses.activate
    @patch("sentry.integrations.gitlab.client.metrics.incr")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_create_forbidden_is_terminal(self, record_event, incr):
        self.repo.update(config={"project_id": "101"})
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            status=403,
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        assert len(responses.calls) == 1
        self.repo.refresh_from_db()
        assert "webhook_id" not in self.repo.config
        assert_slo_metric(record_event, event_outcome=EventLifecycleOutcome.HALTED)
        incr.assert_any_call("gitlab.project_webhook.reconcile", tags={"outcome": "forbidden"})

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

        # The update should include issues_events, merge_requests_events, push_events, and note_events
        assert b"merge_requests_events" in request_body
        assert b"push_events" in request_body
        assert b"issues_events" in request_body
        assert b"note_events" in request_body

        # Verify SLO metrics were recorded
        assert_slo_metric(mock_record_event)
