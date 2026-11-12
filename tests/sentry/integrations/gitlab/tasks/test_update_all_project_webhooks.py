from collections.abc import Callable
from typing import NoReturn, cast
from unittest.mock import MagicMock, call, patch

import pytest
import responses
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import RedisError
from redis.exceptions import TimeoutError as RedisTimeoutError
from requests import PreparedRequest

from fixtures.gitlab import GitLabTestCase
from sentry.constants import ObjectStatus
from sentry.integrations.gitlab.metrics import GitLabWebhookUpdateHaltReason
from sentry.integrations.gitlab.tasks import (
    MAX_RATE_LIMIT_DEFERRALS,
    WEBHOOK_RECONCILIATION_REPOSITORY_COST,
    WebhookReconciliationRateLimitError,
    WebhookReconciliationRedisError,
    _consume_webhook_reconciliation_capacity,
    delete_redundant_project_webhook,
    update_all_project_webhooks,
    update_project_webhook,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.repository import Repository
from sentry.ratelimits.leaky_bucket import LeakyBucketLimitInfo
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiRateLimitedError,
    IntegrationConfigurationError,
)
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_slo_metric
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.redis import redis_clusters


@cell_silo_test
class UpdateAllProjectWebhooksTest(GitLabTestCase):
    """Tests for the main orchestration task that spawns individual webhook update tasks"""

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.apply_async")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_debounce_has_ttl_and_force_bypasses_it(
        self, mock_delay: MagicMock, mock_apply_async: MagicMock
    ) -> None:
        kwargs = {"integration_id": self.integration.id, "organization_id": self.organization.id}
        org_integration = integration_service.get_organization_integration(**kwargs)
        assert org_integration is not None
        config = org_integration.config.copy()

        update_all_project_webhooks(**kwargs)
        assert mock_delay.call_count == 3
        update_all_project_webhooks(**kwargs)
        assert mock_delay.call_count == 3
        update_all_project_webhooks(**kwargs, force=True)
        assert mock_delay.call_count == 3
        assert mock_apply_async.call_count == 3
        update_all_project_webhooks(**kwargs)
        assert mock_delay.call_count == 3
        assert mock_apply_async.call_count == 3

        key = f"gitlab:webhook-reconcile:{self.organization.id}:{self.integration.id}"
        redis = redis_clusters.get("default")
        assert 0 < redis.ttl(key) <= 600
        redis.delete(key)
        update_all_project_webhooks(**kwargs)
        assert mock_delay.call_count == 6
        assert mock_apply_async.call_count == 3
        refreshed = integration_service.get_organization_integration(**kwargs)
        assert refreshed is not None
        assert refreshed.config == config

    def test_redis_connection_error_does_not_block_reconciliation(self) -> None:
        self.assert_reconciliation_without_debounce(RedisConnectionError("Redis unavailable"))

    def test_redis_timeout_does_not_block_forced_reconciliation(self) -> None:
        self.assert_reconciliation_without_debounce(
            RedisTimeoutError("Redis timed out"), force=True
        )

    def assert_reconciliation_without_debounce(
        self, error: RedisError, force: bool = False
    ) -> None:
        with (
            patch("sentry.integrations.gitlab.tasks.redis_clusters") as clusters,
            patch("sentry.integrations.gitlab.tasks.logger.exception") as log_exception,
            patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay") as delay,
            patch(
                "sentry.integrations.gitlab.tasks.update_project_webhook.apply_async"
            ) as apply_async,
            patch("sentry.integrations.gitlab.tasks.release_debounce") as release,
        ):
            clusters.get.return_value.set.side_effect = error
            update_all_project_webhooks(self.integration.id, self.organization.id, force=force)
        expected_repo_ids = {self.repo1.id, self.repo2.id, self.repo3.id}
        scheduled_repo_ids = {mock_call.args[2] for mock_call in delay.call_args_list}
        scheduled_repo_ids.update(
            mock_call.kwargs["args"][2] for mock_call in apply_async.call_args_list
        )
        assert scheduled_repo_ids == expected_repo_ids
        assert delay.call_count == 3 * int(not force)
        assert apply_async.call_count == 3 * int(force)
        release.assert_not_called()
        log_exception.assert_called_once_with(
            "update-all-project-webhooks.debounce-unavailable",
            extra={"integration_id": self.integration.id, "organization_id": self.organization.id},
        )

    def test_fanout_failure_still_raises_when_debounce_is_unavailable(self) -> None:
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
    def test_failed_fanout_can_retry_immediately(self, mock_delay: MagicMock) -> None:
        mock_delay.side_effect = RuntimeError("Task broker unavailable")
        with pytest.raises(RuntimeError, match="Task broker unavailable"):
            update_all_project_webhooks(self.integration.id, self.organization.id)

        mock_delay.reset_mock(side_effect=True)
        update_all_project_webhooks(self.integration.id, self.organization.id)
        assert mock_delay.call_count == 3

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_debounced_run_does_not_load_repositories(self, mock_delay: MagicMock) -> None:
        update_all_project_webhooks(self.integration.id, self.organization.id)
        mock_delay.reset_mock()
        with patch(
            "sentry.integrations.gitlab.tasks.repository_service.get_repositories"
        ) as get_repositories:
            update_all_project_webhooks(self.integration.id, self.organization.id)
        get_repositories.assert_not_called()
        mock_delay.assert_not_called()

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_repository_lookup_failure_can_retry_immediately(self, mock_delay: MagicMock) -> None:
        with patch(
            "sentry.integrations.gitlab.tasks.repository_service.get_repositories",
            side_effect=RuntimeError("Repository service unavailable"),
        ):
            with pytest.raises(RuntimeError, match="Repository service unavailable"):
                update_all_project_webhooks(self.integration.id, self.organization.id)
        update_all_project_webhooks(self.integration.id, self.organization.id)
        assert mock_delay.call_count == 3

    def test_failed_run_does_not_clear_a_newer_debounce(self) -> None:
        key = f"gitlab:webhook-reconcile:{self.organization.id}:{self.integration.id}"
        redis = redis_clusters.get("default")

        def fail_after_debounce_was_replaced(*args: object) -> NoReturn:
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

    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.apply_async")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_forced_failure_preserves_existing_debounce(
        self, mock_delay: MagicMock, mock_apply_async: MagicMock
    ) -> None:
        update_all_project_webhooks(self.integration.id, self.organization.id)
        key = f"gitlab:webhook-reconcile:{self.organization.id}:{self.integration.id}"
        redis = redis_clusters.get("default")
        token = redis.get(key)
        mock_apply_async.side_effect = RuntimeError("Task broker unavailable")
        with pytest.raises(RuntimeError, match="Task broker unavailable"):
            update_all_project_webhooks(self.integration.id, self.organization.id, force=True)
        assert redis.get(key) == token

    def test_debounce_cleanup_failure_preserves_original_error(self) -> None:
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
    def test_debounce_is_scoped_to_organization_and_integration(
        self, mock_delay: MagicMock
    ) -> None:
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
        self.enterContext(
            override_options(
                {
                    "gitlab.webhook-reconcile.rate-limit.burst": 10,
                    "gitlab.webhook-reconcile.rate-limit.per-second": 2,
                }
            )
        )

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
    def test_task_spawns_individual_tasks(
        self, mock_delay: MagicMock, mock_record_event: MagicMock
    ) -> None:
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

    @override_options(
        {
            "gitlab.webhook-reconcile.rate-limit.burst": 3,
            "gitlab.webhook-reconcile.rate-limit.per-second": 1,
        }
    )
    @patch("sentry.integrations.gitlab.tasks.randint", return_value=3)
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.apply_async")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_staggers_fanout_after_initial_burst(
        self,
        mock_delay: MagicMock,
        mock_apply_async: MagicMock,
        mock_randint: MagicMock,
    ) -> None:
        update_all_project_webhooks(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

        mock_delay.assert_called_once_with(self.integration.id, self.organization.id, self.repo1.id)
        assert mock_apply_async.call_args_list == [
            call(
                args=(self.integration.id, self.organization.id, self.repo2.id),
                countdown=6,
            ),
            call(
                args=(self.integration.id, self.organization.id, self.repo3.id),
                countdown=9,
            ),
        ]
        assert mock_randint.call_args_list == [call(0, 5), call(0, 5)]

    @override_options(
        {
            "gitlab.webhook-reconcile.rate-limit.burst": 3,
            "gitlab.webhook-reconcile.rate-limit.per-second": 1,
            "gitlab.webhook-reconcile.forced-fanout-jitter-max-seconds": 1801,
        }
    )
    @patch("sentry.integrations.gitlab.tasks.randint", return_value=300)
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.apply_async")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_forced_task_spreads_fanout_across_configured_jitter(
        self,
        mock_delay: MagicMock,
        mock_apply_async: MagicMock,
        mock_randint: MagicMock,
    ) -> None:
        update_all_project_webhooks(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            force=True,
        )

        mock_delay.assert_not_called()
        assert mock_apply_async.call_args_list == [
            call(
                args=(self.integration.id, self.organization.id, self.repo1.id),
                countdown=300,
            ),
            call(
                args=(self.integration.id, self.organization.id, self.repo2.id),
                countdown=303,
            ),
            call(
                args=(self.integration.id, self.organization.id, self.repo3.id),
                countdown=306,
            ),
        ]
        assert mock_randint.call_args_list == [call(67, 1801), call(67, 1801), call(67, 1801)]

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_handles_integration_not_found(
        self, mock_delay: MagicMock, mock_record_event: MagicMock
    ) -> None:
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
    def test_task_only_updates_active_repositories_for_installing_organization(
        self, mock_delay: MagicMock
    ) -> None:
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
    def test_task_handles_no_repositories(
        self, mock_delay: MagicMock, mock_record_event: MagicMock
    ) -> None:
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
    def test_task_handles_org_integration_not_found(
        self, mock_delay: MagicMock, mock_record_event: MagicMock
    ) -> None:
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
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.apply_async")
    @patch("sentry.integrations.gitlab.tasks.update_project_webhook.delay")
    def test_task_skips_repositories_missing_webhook_config(
        self,
        mock_delay: MagicMock,
        mock_apply_async: MagicMock,
        mock_record_event: MagicMock,
    ) -> None:
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

        # Verify all repos had tasks spawned
        spawned_repo_ids = {call.args[2] for call in mock_delay.call_args_list}
        spawned_repo_ids.update(call.kwargs["args"][2] for call in mock_apply_async.call_args_list)
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
    def test_task_only_processes_active_repositories(
        self, mock_delay: MagicMock, mock_record_event: MagicMock
    ) -> None:
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
class WebhookReconciliationCapacityTest(GitLabTestCase):
    @patch("sentry.integrations.gitlab.tasks.LeakyBucketRateLimiter")
    def test_capacity_is_scoped_to_gitlab_identity(self, limiter: MagicMock) -> None:
        limiter.return_value.use_and_get_info.return_value = LeakyBucketLimitInfo(
            burst_limit=10, drip_rate=2
        )

        _consume_webhook_reconciliation_capacity(
            "https://example.gitlab.com", "example.gitlab.com:123"
        )

        limiter.assert_called_once_with(
            burst_limit=3,
            drip_rate=1,
            key="gitlab:webhook-reconcile:example.gitlab.com:example.gitlab.com:123",
            fail_open=False,
        )
        limiter.return_value.use_and_get_info.assert_called_once_with(
            incr_by=WEBHOOK_RECONCILIATION_REPOSITORY_COST
        )

    @override_options(
        {
            "gitlab.webhook-reconcile.rate-limit.burst": 100,
            "gitlab.webhook-reconcile.rate-limit.per-second": 100,
        }
    )
    @patch("sentry.integrations.gitlab.tasks.LeakyBucketRateLimiter")
    def test_capacity_options_are_clamped(self, limiter: MagicMock) -> None:
        limiter.return_value.use_and_get_info.return_value = LeakyBucketLimitInfo(
            burst_limit=10, drip_rate=2
        )

        _consume_webhook_reconciliation_capacity(
            "https://example.gitlab.com", "example.gitlab.com:123"
        )

        limiter.assert_called_once_with(
            burst_limit=10,
            drip_rate=2,
            key="gitlab:webhook-reconcile:example.gitlab.com:example.gitlab.com:123",
            fail_open=False,
        )


@cell_silo_test
class UpdateProjectWebhookTest(GitLabTestCase):
    """Tests for the individual webhook update task"""

    reconciliation_id = "reconciliation-id"

    def setUp(self) -> None:
        super().setUp()
        capacity_patcher = patch(
            "sentry.integrations.gitlab.tasks._consume_webhook_reconciliation_capacity",
            return_value=LeakyBucketLimitInfo(burst_limit=10, drip_rate=2),
        )
        self.consume_capacity = capacity_patcher.start()
        self.addCleanup(capacity_patcher.stop)
        time_patcher = patch("sentry.integrations.gitlab.tasks.time", return_value=300)
        self.task_time = time_patcher.start()
        self.addCleanup(time_patcher.stop)
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

    def _add_hook_list(self, hooks: list[dict[str, object]] | None = None) -> None:
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            json=hooks or [],
        )

    def _set_missing_webhook(self) -> None:
        self.repo.update(
            config={
                "project_id": "101",
                "path": "test-group/repo",
                "webhook_reconciliation_id": self.reconciliation_id,
            }
        )

    def _marked_webhook_url(self) -> str:
        installation = self.integration.get_installation(organization_id=self.organization.id)
        return installation.get_client().project_webhook_url(self.reconciliation_id)

    def _unmarked_webhook_url(self) -> str:
        installation = self.integration.get_installation(organization_id=self.organization.id)
        return installation.get_client().project_webhook_url()

    @patch("sentry.integrations.gitlab.tasks.randint", side_effect=[99, 601])
    def test_task_spreads_hourly_burst_before_calling_gitlab(self, randint: MagicMock) -> None:
        self.task_time.return_value = 120
        self.consume_capacity.reset_mock()

        with (
            patch.object(update_project_webhook, "apply_async") as apply_async,
            patch("sentry.integrations.gitlab.tasks.logger.info") as logger_info,
        ):
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
                rate_limit_deferrals=4,
            )

        apply_async.assert_called_once_with(
            kwargs={
                "integration_id": self.integration.id,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
                "rate_limit_deferrals": 4,
            },
            countdown=601,
        )
        assert randint.call_args_list == [call(1, 100), call(180, 3000)]
        self.consume_capacity.assert_not_called()
        logger_info.assert_called_once_with(
            "update-project-webhook.hourly-burst-deferred",
            extra={
                "integration_id": self.integration.id,
                "organization_id": self.organization.id,
                "rate_limit_countdown": 601,
                "rate_limit_source": "hourly_burst",
                "repository_id": self.repo.id,
            },
        )

    @patch("sentry.integrations.gitlab.tasks.randint", return_value=100)
    @patch("sentry.integrations.gitlab.tasks.integration_service.get_integration")
    def test_task_allows_one_percent_through_hourly_burst(
        self, get_integration: MagicMock, randint: MagicMock
    ) -> None:
        self.task_time.return_value = 0
        get_integration.return_value = None

        with patch.object(update_project_webhook, "apply_async") as apply_async:
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )

        apply_async.assert_not_called()
        randint.assert_called_once_with(1, 100)
        get_integration.assert_called_once()

    @override_options({"gitlab.webhook-reconcile.rate-limit.retry-delay-seconds": 10})
    @patch("sentry.integrations.gitlab.tasks.randint", return_value=3)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_task_defers_when_region_rate_limit_is_exhausted(
        self, record_event: MagicMock, randint: MagicMock
    ) -> None:
        self.consume_capacity.return_value = LeakyBucketLimitInfo(
            burst_limit=10,
            drip_rate=2,
            current_level=10,
            wait_time=0.5,
        )

        with (
            patch.object(update_project_webhook, "apply_async") as apply_async,
            patch("sentry.integrations.gitlab.tasks.logger.info") as mock_logger_info,
        ):
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
                rate_limit_deferrals=4,
            )

        apply_async.assert_called_once_with(
            kwargs={
                "integration_id": self.integration.id,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
                "rate_limit_deferrals": 5,
            },
            countdown=13,
        )
        randint.assert_called_once_with(0, 5)
        self.consume_capacity.assert_called_once_with("https://example.gitlab.com", "gitlab123")
        mock_logger_info.assert_not_called()
        assert_slo_metric(record_event, event_outcome=EventLifecycleOutcome.HALTED)

    @responses.activate
    @override_options({"gitlab.webhook-reconcile.rate-limit.retry-after-jitter-seconds": 3600})
    @patch("sentry.integrations.gitlab.tasks.randint", return_value=7)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.metrics.incr")
    def test_task_defers_for_gitlab_retry_after(
        self, incr: MagicMock, record_event: MagicMock, randint: MagicMock
    ) -> None:
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            status=429,
            json={"message": "Rate limit exceeded"},
            headers={"Retry-After": "120"},
        )

        with (
            patch.object(update_project_webhook, "apply_async") as apply_async,
            patch("sentry.integrations.gitlab.tasks.logger.info") as mock_logger_info,
        ):
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
                rate_limit_deferrals=4,
            )

        apply_async.assert_called_once_with(
            kwargs={
                "integration_id": self.integration.id,
                "organization_id": self.organization.id,
                "repository_id": self.repo.id,
                "rate_limit_deferrals": 5,
            },
            countdown=127,
        )
        randint.assert_called_once_with(0, 300)
        incr.assert_any_call("gitlab.project_webhook.reconcile", tags={"outcome": "rate_limited"})
        mock_logger_info.assert_not_called()
        assert_slo_metric(record_event, event_outcome=EventLifecycleOutcome.HALTED)

    @responses.activate
    def test_task_retries_gitlab_rate_limit_without_retry_after(self) -> None:
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            status=429,
            json={"message": "Rate limit exceeded"},
        )

        with pytest.raises(ApiRateLimitedError):
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )

    def test_task_fails_after_rate_limit_deferral_budget_is_exhausted(self) -> None:
        self.consume_capacity.return_value = LeakyBucketLimitInfo(
            burst_limit=10,
            drip_rate=2,
            current_level=10,
            wait_time=0.5,
        )

        with pytest.raises(WebhookReconciliationRateLimitError):
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
                rate_limit_deferrals=MAX_RATE_LIMIT_DEFERRALS,
            )

    @responses.activate
    def test_task_does_not_call_gitlab_when_rate_limit_redis_is_unavailable(self) -> None:
        self.consume_capacity.side_effect = WebhookReconciliationRedisError("Redis unavailable")

        with pytest.raises(WebhookReconciliationRedisError):
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )

        assert len(responses.calls) == 0

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_updates_webhook(self, mock_record_event: MagicMock) -> None:
        """Test that the task successfully updates a webhook"""
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"id": "webhook-1"},
            status=200,
        )

        with patch("sentry.integrations.gitlab.tasks.logger.info") as mock_logger_info:
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )

        # Verify webhook was updated
        assert len(responses.calls) == 1
        assert "101" in responses.calls[0].request.url
        assert "webhook-1" in responses.calls[0].request.url

        mock_logger_info.assert_called_once_with(
            "update-project-webhook.success",
            extra={
                "integration_id": self.integration.id,
                "interaction_type": "update_project_webhook",
                "organization_id": self.organization.id,
                "outcome": "updated",
                "repository_id": self.repo.id,
            },
        )

        # Verify SLO metrics were recorded
        assert_slo_metric(mock_record_event)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_handles_integration_not_found(self, mock_record_event: MagicMock) -> None:
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
    @patch("sentry.integrations.gitlab.tasks._project_webhook_lock")
    def test_task_retries_lock_contention_as_halt(
        self, project_webhook_lock: MagicMock, record_event: MagicMock
    ) -> None:
        lock = MagicMock()
        lock.blocking_acquire.side_effect = UnableToAcquireLock
        project_webhook_lock.return_value = lock

        with pytest.raises(UnableToAcquireLock):
            update_project_webhook(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                repository_id=self.repo.id,
            )

        assert_slo_metric(record_event, event_outcome=EventLifecycleOutcome.HALTED)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_handles_repository_not_found(self, mock_record_event: MagicMock) -> None:
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
    def test_task_handles_inactive_repository(self, mock_record_event: MagicMock) -> None:
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
    def test_task_halts_when_repository_was_repointed(self, mock_record_event: MagicMock) -> None:
        other = self.create_integration(
            organization=self.organization, external_id="other", provider="gitlab"
        )
        Repository.objects.filter(id=self.repo.id).update(integration_id=other.id)

        update_project_webhook(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            repository_id=self.repo.id,
        )

        assert len(responses.calls) == 0
        last_call = mock_record_event.call_args_list[-1]
        assert last_call[0][0] == EventLifecycleOutcome.HALTED
        assert last_call[0][1] == GitLabWebhookUpdateHaltReason.REPOSITORY_CHANGED

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_handles_missing_project_id(self, mock_record_event: MagicMock) -> None:
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
    def test_task_retries_on_failure(self, mock_record_event: MagicMock) -> None:
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
    def test_task_handles_auth_errors(self, mock_record_event: MagicMock) -> None:
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
    def test_task_handles_not_found_errors(self, mock_record_event: MagicMock) -> None:
        """Test that the task retries on API failures"""
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"error": "Not Found"},
            status=404,
        )
        self._add_hook_list()
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
        assert [call.request.method for call in responses.calls] == ["PUT", "GET", "POST"]

        # Verify SLO failure metric was recorded
        assert_slo_metric(mock_record_event, event_outcome=EventLifecycleOutcome.FAILURE)

    @responses.activate
    def test_task_creates_missing_webhook(self) -> None:
        self._set_missing_webhook()
        self._add_hook_list()
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
            "webhook_reconciliation_id": self.reconciliation_id,
            "webhook_id": 100,
        }
        assert [call.request.method for call in responses.calls] == ["GET", "POST"]

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_task_does_not_create_when_hook_listing_is_truncated(
        self, record_event: MagicMock
    ) -> None:
        self._set_missing_webhook()
        self._add_hook_list(
            [
                {"id": 1, "url": self._unmarked_webhook_url()},
                {"id": 2, "url": self._unmarked_webhook_url()},
            ]
        )
        self._add_hook_list(
            [
                {"id": 3, "url": self._unmarked_webhook_url()},
                {"id": 4, "url": self._unmarked_webhook_url()},
            ]
        )

        with (
            patch("sentry.integrations.gitlab.client.GitLabApiClient.page_size", 2),
            patch("sentry.integrations.gitlab.client.GitLabApiClient.page_number_limit", 2),
        ):
            update_project_webhook(self.integration.id, self.organization.id, self.repo.id)

        self.repo.refresh_from_db()
        assert "webhook_id" not in self.repo.config
        assert [call.request.method for call in responses.calls] == ["GET", "GET"]
        assert_slo_metric(record_event, event_outcome=EventLifecycleOutcome.HALTED)

    @responses.activate
    def test_task_persists_creation_identity_before_post(self) -> None:
        self.repo.update(config={"project_id": "101", "path": "test-group/repo"})
        self._add_hook_list()

        def create(request: PreparedRequest) -> tuple[int, dict[str, str], str]:
            self.repo.refresh_from_db()
            reconciliation_id = self.repo.config["webhook_reconciliation_id"]
            assert self.repo.config["webhook_reconciliation_pending"] is True
            assert reconciliation_id.encode() in cast(bytes, request.body)
            return 201, {}, '{"id": 100}'

        responses.add_callback(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            callback=create,
        )

        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 100
        assert "webhook_reconciliation_pending" not in self.repo.config

    @responses.activate
    @patch("sentry.integrations.gitlab.tasks.metrics.incr")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch(
        "sentry.integrations.gitlab.tasks.repository_service.update_repository_config",
        return_value=False,
    )
    def test_task_records_repository_changed_when_reconciliation_id_write_loses_race(
        self, update_repository_config: MagicMock, record_event: MagicMock, incr: MagicMock
    ) -> None:
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            status=404,
        )

        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)

        update_repository_config.assert_called_once()
        assert [request.request.method for request in responses.calls] == ["PUT"]
        assert_slo_metric(record_event, event_outcome=EventLifecycleOutcome.HALTED)
        incr.assert_any_call(
            "gitlab.project_webhook.reconcile", tags={"outcome": "repository_changed"}
        )

    @responses.activate
    def test_task_recreates_stale_webhook(self) -> None:
        self.repo.config["webhook_reconciliation_id"] = self.reconciliation_id
        self.repo.save()
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            status=404,
        )
        self._add_hook_list()
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            json={"id": 100},
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 100
        assert [call.request.method for call in responses.calls] == ["PUT", "GET", "POST"]

    @responses.activate
    def test_task_replaces_disabled_webhook(self) -> None:
        self.repo.config["webhook_reconciliation_id"] = self.reconciliation_id
        self.repo.save()
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
        self._add_hook_list()
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            json={"id": 100},
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 100
        assert [call.request.method for call in responses.calls] == [
            "PUT",
            "DELETE",
            "GET",
            "POST",
        ]

    def _create_hook_while(self, change_repository: Callable[[], object]) -> None:
        """Register a hook create that changes the repository mid-request, as a concurrent writer would."""

        def create(request: PreparedRequest) -> tuple[int, dict[str, str], str]:
            change_repository()
            return 201, {}, '{"id": 100}'

        self._set_missing_webhook()
        self.repo.refresh_from_db()
        self._add_hook_list()
        responses.add_callback(
            responses.POST, "https://example.gitlab.com/api/v4/projects/101/hooks", callback=create
        )

    @responses.activate
    def test_task_preserves_config_written_during_repair(self) -> None:
        def change_repository() -> None:
            current = Repository.objects.get(id=self.repo.id)
            Repository.objects.filter(id=self.repo.id).update(
                name="renamed", config={**current.config, "sync_comments": True}
            )

        self._create_hook_while(change_repository)
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        self.repo.refresh_from_db()
        assert self.repo.name == "renamed"
        assert self.repo.config == {
            "project_id": "101",
            "path": "test-group/repo",
            "sync_comments": True,
            "webhook_reconciliation_id": self.reconciliation_id,
            "webhook_id": 100,
        }
        assert [call.request.method for call in responses.calls] == ["GET", "POST"]

    @responses.activate
    @patch("sentry.integrations.gitlab.tasks.metrics.incr")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.gitlab.tasks.delete_redundant_project_webhook.delay")
    def test_task_queues_cleanup_when_repository_disabled_during_repair(
        self, cleanup_delay: MagicMock, record_event: MagicMock, incr: MagicMock
    ) -> None:
        self._create_hook_while(
            lambda: Repository.objects.filter(id=self.repo.id).update(status=ObjectStatus.DISABLED)
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        self.repo.refresh_from_db()
        assert self.repo.status == ObjectStatus.DISABLED
        assert "webhook_id" not in self.repo.config
        cleanup_delay.assert_called_once_with(
            self.integration.id,
            self.organization.id,
            self.repo.id,
            "101",
            100,
            self.reconciliation_id,
        )
        assert [call.request.method for call in responses.calls] == ["GET", "POST"]
        assert_slo_metric(record_event, event_outcome=EventLifecycleOutcome.HALTED)
        incr.assert_any_call(
            "gitlab.project_webhook.reconcile", tags={"outcome": "repository_changed"}
        )

    @responses.activate
    @patch("sentry.integrations.gitlab.tasks.delete_redundant_project_webhook.delay")
    def test_task_queues_cleanup_when_repository_moved_during_repair(
        self, cleanup_delay: MagicMock
    ) -> None:
        other = self.create_integration(
            organization=self.organization, external_id="other", provider="gitlab"
        )
        self._create_hook_while(
            lambda: Repository.objects.filter(id=self.repo.id).update(integration_id=other.id)
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        self.repo.refresh_from_db()
        assert self.repo.integration_id == other.id
        assert "webhook_id" not in self.repo.config
        cleanup_delay.assert_called_once()
        assert [call.request.method for call in responses.calls] == ["GET", "POST"]

    @responses.activate
    @patch("sentry.integrations.gitlab.tasks.delete_redundant_project_webhook.delay")
    def test_task_queues_cleanup_when_repaired_concurrently(self, cleanup_delay: MagicMock) -> None:
        self._create_hook_while(
            lambda: Repository.objects.filter(id=self.repo.id).update(
                config={**self.repo.config, "webhook_id": 99}
            )
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 99
        cleanup_delay.assert_called_once()
        assert [call.request.method for call in responses.calls] == ["GET", "POST"]

    @responses.activate
    @patch("sentry.integrations.gitlab.tasks.metrics.incr")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_create_forbidden_is_terminal(self, record_event: MagicMock, incr: MagicMock) -> None:
        self._set_missing_webhook()
        self._add_hook_list()
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            status=403,
        )
        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)
        assert [call.request.method for call in responses.calls] == ["GET", "POST"]
        self.repo.refresh_from_db()
        assert "webhook_id" not in self.repo.config
        assert_slo_metric(record_event, event_outcome=EventLifecycleOutcome.HALTED)
        incr.assert_any_call("gitlab.project_webhook.reconcile", tags={"outcome": "forbidden"})

    @responses.activate
    @patch("sentry.integrations.gitlab.tasks.delete_redundant_project_webhook.delay")
    def test_task_adopts_marked_hook_and_queues_duplicate_cleanup(
        self, cleanup_delay: MagicMock
    ) -> None:
        self._set_missing_webhook()
        self._add_hook_list(
            [
                {"id": 100, "url": self._marked_webhook_url()},
                {"id": 101, "url": self._marked_webhook_url()},
                {"id": 102, "url": self._unmarked_webhook_url()},
            ]
        )
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/100",
            json={"id": 100},
        )

        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)

        self.repo.refresh_from_db()
        assert self.repo.config == {
            "project_id": "101",
            "path": "test-group/repo",
            "webhook_reconciliation_id": self.reconciliation_id,
            "webhook_id": 100,
        }
        cleanup_delay.assert_called_once_with(
            self.integration.id,
            self.organization.id,
            self.repo.id,
            "101",
            101,
            self.reconciliation_id,
        )
        assert [call.request.method for call in responses.calls] == ["GET", "PUT"]

    @responses.activate
    def test_task_does_not_adopt_disabled_marked_hook(self) -> None:
        self._set_missing_webhook()
        self._add_hook_list(
            [
                {
                    "id": 100,
                    "url": self._marked_webhook_url(),
                    "alert_status": "disabled",
                }
            ]
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            json={"id": 101},
        )

        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 101
        assert [call.request.method for call in responses.calls] == ["GET", "POST"]

    @responses.activate
    def test_task_adopts_hook_after_ambiguous_create_failure(self) -> None:
        self._set_missing_webhook()
        self._add_hook_list()
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/101/hooks",
            status=500,
        )

        with pytest.raises(ApiError):
            update_project_webhook(self.integration.id, self.organization.id, self.repo.id)

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_reconciliation_pending"] is True
        assert "webhook_id" not in self.repo.config

        responses.reset()
        self._add_hook_list([{"id": 100, "url": self._marked_webhook_url()}])
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/100",
            json={"id": 100},
        )

        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 100
        assert "webhook_reconciliation_pending" not in self.repo.config
        assert [call.request.method for call in responses.calls] == ["GET", "PUT"]

    @responses.activate
    @patch("sentry.integrations.gitlab.tasks.metrics.incr")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch(
        "sentry.integrations.gitlab.tasks.repository_service.update_repository_config",
        return_value=False,
    )
    def test_task_records_repository_changed_when_pending_clear_loses_race(
        self, update_repository_config: MagicMock, record_event: MagicMock, incr: MagicMock
    ) -> None:
        self.repo.update(
            config={
                **self.repo.config,
                "webhook_reconciliation_id": self.reconciliation_id,
                "webhook_reconciliation_pending": True,
            }
        )
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"id": "webhook-1"},
        )
        self._add_hook_list()

        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)

        update_repository_config.assert_called_once()
        assert_slo_metric(record_event, event_outcome=EventLifecycleOutcome.HALTED)
        incr.assert_any_call(
            "gitlab.project_webhook.reconcile", tags={"outcome": "repository_changed"}
        )

    @responses.activate
    @patch("sentry.integrations.gitlab.tasks.delete_redundant_project_webhook.delay")
    def test_task_resumes_duplicate_cleanup_while_pending(self, cleanup_delay: MagicMock) -> None:
        self.repo.update(
            config={
                **self.repo.config,
                "webhook_reconciliation_id": self.reconciliation_id,
                "webhook_reconciliation_pending": True,
            }
        )
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/101/hooks/webhook-1",
            json={"id": "webhook-1"},
        )
        self._add_hook_list(
            [
                {"id": 100, "url": self._marked_webhook_url()},
                {"id": 101, "url": self._unmarked_webhook_url()},
            ]
        )

        update_project_webhook(self.integration.id, self.organization.id, self.repo.id)

        self.repo.refresh_from_db()
        assert "webhook_reconciliation_pending" not in self.repo.config
        cleanup_delay.assert_called_once_with(
            self.integration.id,
            self.organization.id,
            self.repo.id,
            "101",
            100,
            self.reconciliation_id,
        )

    @responses.activate
    def test_cleanup_deletes_only_an_exact_unreferenced_hook(self) -> None:
        self._set_missing_webhook()
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/101/hooks/100",
            json={"id": 100, "url": self._marked_webhook_url()},
        )
        responses.add(
            responses.DELETE,
            "https://example.gitlab.com/api/v4/projects/101/hooks/100",
            status=204,
        )

        delete_redundant_project_webhook(
            self.integration.id,
            self.organization.id,
            self.repo.id,
            "101",
            100,
            self.reconciliation_id,
        )

        assert [call.request.method for call in responses.calls] == ["GET", "DELETE"]

    @responses.activate
    def test_cleanup_preserves_a_hook_without_the_exact_marker(self) -> None:
        self._set_missing_webhook()
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/101/hooks/100",
            json={"id": 100, "url": self._unmarked_webhook_url()},
        )

        delete_redundant_project_webhook(
            self.integration.id,
            self.organization.id,
            self.repo.id,
            "101",
            100,
            self.reconciliation_id,
        )

        assert [call.request.method for call in responses.calls] == ["GET"]

    @responses.activate
    def test_cleanup_preserves_stored_hook_after_integration_repoint(self) -> None:
        other = self.create_integration(
            organization=self.organization, external_id="other", provider="gitlab"
        )
        Repository.objects.filter(id=self.repo.id).update(
            integration_id=other.id,
            config={
                "project_id": "101",
                "webhook_id": 100,
                "webhook_reconciliation_id": self.reconciliation_id,
            },
        )

        delete_redundant_project_webhook(
            self.integration.id,
            self.organization.id,
            self.repo.id,
            "101",
            100,
            self.reconciliation_id,
        )

        assert len(responses.calls) == 0

    @responses.activate
    def test_cleanup_preserves_hook_repointed_during_remote_fetch(self) -> None:
        self._set_missing_webhook()
        other = self.create_integration(
            organization=self.organization, external_id="other", provider="gitlab"
        )

        def get_hook(request: PreparedRequest) -> tuple[int, dict[str, str], str]:
            Repository.objects.filter(id=self.repo.id).update(
                integration_id=other.id,
                config={
                    "project_id": "101",
                    "webhook_id": 100,
                    "webhook_reconciliation_id": self.reconciliation_id,
                },
            )
            return 200, {}, f'{{"id": 100, "url": "{self._marked_webhook_url()}"}}'

        responses.add_callback(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/101/hooks/100",
            callback=get_hook,
        )

        delete_redundant_project_webhook(
            self.integration.id,
            self.organization.id,
            self.repo.id,
            "101",
            100,
            self.reconciliation_id,
        )

        assert [call.request.method for call in responses.calls] == ["GET"]

    @patch("sentry.integrations.gitlab.tasks.logger.info")
    @patch(
        "sentry.integrations.gitlab.integration.GitlabIntegration.get_client",
        side_effect=IntegrationConfigurationError("Identity not found."),
    )
    def test_cleanup_halts_when_identity_is_unavailable(
        self, get_client: MagicMock, logger_info: MagicMock
    ) -> None:
        self._set_missing_webhook()

        delete_redundant_project_webhook(
            self.integration.id,
            self.organization.id,
            self.repo.id,
            "101",
            100,
            self.reconciliation_id,
        )

        get_client.assert_called_once()
        logger_info.assert_called_once_with(
            "delete-redundant-project-webhook.identity-unavailable",
            extra={"project_id": "101", "webhook_id": 100},
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_task_updates_webhook_with_correct_data(self, mock_record_event: MagicMock) -> None:
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
