import errno
from contextlib import nullcontext
from types import SimpleNamespace
from typing import cast
from unittest.mock import MagicMock, patch

import pytest

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.bitbucket_server.tasks import (
    REPAIR_METRIC,
    repair_repository_webhook,
)
from sentry.integrations.bitbucket_server.webhook_reconciliation import (
    WebhookReconciliationMode,
    WebhookReconciliationOutcome,
    WebhookReconciliationResult,
    cleanup_repository_webhook,
    reconcile_repository_webhook,
)
from sentry.integrations.services.repository import RpcRepository
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class RepairRepositoryWebhookTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration_id = 10
        self.organization_id = 20
        self.repository_id = 30
        self.context = {
            "integration_id": self.integration_id,
            "organization_id": self.organization_id,
            "repository_id": self.repository_id,
        }
        self.repository = SimpleNamespace(
            id=self.repository_id,
            organization_id=self.organization_id,
            status=ObjectStatus.ACTIVE,
            integration_id=self.integration_id,
            external_id="987",
            config={
                "project": "PROJ",
                "repo": "repository",
                "webhook_id": 123,
                "webhook_secret": "existing-secret",
                "webhook_repair_pending": True,
            },
        )
        self.bitbucket_client = MagicMock()
        self.bitbucket_client.get_repo.return_value = {"id": 987}
        self.integration = MagicMock(
            id=self.integration_id,
            provider="bitbucket_server",
        )
        self.integration.get_installation.return_value.get_client.return_value = (
            self.bitbucket_client
        )

        self.get_repository = patch(
            "sentry.integrations.bitbucket_server.tasks.repository_service.get_repository",
            return_value=self.repository,
        ).start()
        self.update_config = patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.repository_service.update_repository_config",
            return_value=True,
        ).start()
        self.get_integration = patch(
            "sentry.integrations.bitbucket_server.tasks.integration_service.get_integration",
            return_value=self.integration,
        ).start()
        self.incr = patch("sentry.integrations.bitbucket_server.tasks.metrics.incr").start()
        self.get_lock = patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.locks.get"
        ).start()
        self.get_lock.return_value.blocking_acquire.return_value = nullcontext()
        self.addCleanup(patch.stopall)

    def run_task(self, *, enabled: bool = True) -> None:
        get_option = options.get
        with patch(
            "sentry.integrations.bitbucket_server.tasks.options.get",
            side_effect=lambda key: (
                enabled
                if key == "bitbucket_server.webhook.secret-repair.enabled"
                else get_option(key)
            ),
        ):
            repair_repository_webhook(**self.context)

    def assert_outcome(self, outcome: str) -> None:
        self.incr.assert_any_call(REPAIR_METRIC, tags={"outcome": outcome})

    def test_disabled_does_not_load_state(self) -> None:
        self.run_task(enabled=False)

        self.get_repository.assert_not_called()
        self.get_integration.assert_not_called()
        self.assert_outcome("disabled")

    def test_completed_repair_does_not_call_bitbucket(self) -> None:
        self.repository.config.pop("webhook_repair_pending")

        self.run_task()

        self.integration.get_installation.assert_not_called()
        self.assert_outcome("already_repaired")

    def test_updates_existing_hook_and_removes_pending_flag(self) -> None:
        self.bitbucket_client.get_hook.return_value = {
            "id": 123,
            "name": "existing name",
            "url": "https://example.com/existing",
            "active": False,
            "events": ["repo:modified"],
        }

        self.run_task()

        self.bitbucket_client.update_hook.assert_called_once_with(
            "PROJ",
            "repository",
            123,
            {
                "name": "existing name",
                "url": "https://example.com/existing",
                "active": False,
                "events": ["repo:modified"],
                "configuration": {"secret": "existing-secret"},
            },
        )
        self.update_config.assert_called_once_with(
            organization_id=self.organization_id,
            id=self.repository_id,
            config_updates={},
            config_deletions=["webhook_repair_pending"],
            expected_integration_id=self.integration_id,
            expected_external_id="987",
            expected_config={
                "project": "PROJ",
                "repo": "repository",
                "webhook_id": 123,
                "webhook_secret": "existing-secret",
                "webhook_repair_pending": True,
                "webhook_reconciliation_id": None,
            },
        )
        self.assert_outcome("updated")

    def test_generates_secret_before_updating_existing_hook(self) -> None:
        self.repository.config.pop("webhook_secret")
        self.repository.config.pop("webhook_repair_pending")
        self.bitbucket_client.get_hook.return_value = {
            "id": 123,
            "name": "hook",
            "url": "https://example.com/hook",
            "active": True,
            "events": [],
        }

        with patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.secrets.token_hex",
            return_value="generated-secret",
        ):
            self.run_task()

        assert self.update_config.call_args_list[0].kwargs["config_updates"] == {
            "webhook_secret": "generated-secret",
            "webhook_repair_pending": True,
        }
        assert self.update_config.call_args_list[1].kwargs["config_updates"] == {}
        assert self.bitbucket_client.update_hook.call_args.args[3]["configuration"] == {
            "secret": "generated-secret"
        }
        self.assert_outcome("updated")

    def test_missing_webhook_id_stops_without_repair(self) -> None:
        self.repository.config.pop("webhook_id")
        self.repository.config.pop("webhook_secret")
        self.repository.config.pop("webhook_repair_pending")

        with patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.secrets.token_hex",
        ) as token_hex:
            self.run_task()

        token_hex.assert_not_called()
        self.integration.get_installation.assert_not_called()
        self.update_config.assert_not_called()
        self.assert_outcome("missing_webhook")

    def test_missing_remote_hook_stops_without_repair(self) -> None:
        for operation in ("get", "update"):
            with self.subTest(operation=operation):
                self.bitbucket_client.reset_mock()
                self.update_config.reset_mock()
                if operation == "get":
                    self.bitbucket_client.get_hook.side_effect = ApiError("missing", code=404)
                else:
                    self.bitbucket_client.get_hook.side_effect = None
                    self.bitbucket_client.get_hook.return_value = {
                        "id": 123,
                        "name": "hook",
                        "url": "https://example.com/hook",
                        "active": True,
                        "events": [],
                    }
                    self.bitbucket_client.update_hook.side_effect = ApiError("missing", code=404)

                self.run_task()

                self.bitbucket_client.list_hooks.assert_not_called()
                self.bitbucket_client.create_hook.assert_not_called()
                self.bitbucket_client.delete_hook.assert_not_called()
                self.update_config.assert_called_once_with(
                    organization_id=self.organization_id,
                    id=self.repository_id,
                    config_updates={"webhook_repair_pending": False},
                    expected_integration_id=self.integration_id,
                    expected_external_id="987",
                    expected_config={
                        "project": "PROJ",
                        "repo": "repository",
                        "webhook_id": 123,
                        "webhook_secret": "existing-secret",
                        "webhook_repair_pending": True,
                        "webhook_reconciliation_id": None,
                    },
                )
                self.assert_outcome("missing_webhook")

    def test_missing_remote_hook_marks_new_repair_not_pending(self) -> None:
        self.repository.config.pop("webhook_secret")
        self.repository.config.pop("webhook_repair_pending")
        self.bitbucket_client.get_hook.side_effect = ApiError("missing", code=404)

        with patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.secrets.token_hex",
            return_value="generated-secret",
        ):
            self.run_task()

        assert self.update_config.call_count == 2
        assert self.update_config.call_args_list[0].kwargs["config_updates"] == {
            "webhook_secret": "generated-secret",
            "webhook_repair_pending": True,
        }
        assert self.update_config.call_args_list[1].kwargs["config_updates"] == {
            "webhook_repair_pending": False
        }
        self.assert_outcome("missing_webhook")

    def test_missing_remote_hook_state_conflict_is_observable(self) -> None:
        self.bitbucket_client.get_hook.side_effect = ApiError("missing", code=404)
        self.update_config.return_value = False

        self.run_task()

        self.assert_outcome("conflict")

    def test_authorization_failure_does_not_create_or_retry(self) -> None:
        for status_code in (401, 403):
            with self.subTest(status_code=status_code):
                self.bitbucket_client.reset_mock()
                self.update_config.reset_mock()
                self.bitbucket_client.get_repo.return_value = {"id": 987}
                self.bitbucket_client.get_hook.side_effect = ApiError("denied", code=status_code)

                self.run_task()

                self.bitbucket_client.create_hook.assert_not_called()
                self.update_config.assert_not_called()
                self.assert_outcome("unauthorized")

    def test_transient_failure_is_raised_for_retry(self) -> None:
        for status_code in (429, 500, 502, 503, 504, 599):
            self.bitbucket_client.reset_mock()
            self.update_config.reset_mock()
            self.bitbucket_client.get_repo.return_value = {"id": 987}
            self.bitbucket_client.get_hook.side_effect = ApiError("temporary", code=status_code)

            with pytest.raises(ApiError):
                self.run_task()

            self.bitbucket_client.create_hook.assert_not_called()
            self.update_config.assert_not_called()
            self.assert_outcome("transient_error")

    def test_connection_reset_is_raised_for_retry(self) -> None:
        self.bitbucket_client.get_hook.side_effect = ApiError("reset", code=errno.ECONNRESET)

        with pytest.raises(ApiError):
            self.run_task()

        self.bitbucket_client.create_hook.assert_not_called()
        self.update_config.assert_not_called()
        self.assert_outcome("transient_error")

    def test_non_transient_failure_does_not_create_or_retry(self) -> None:
        self.bitbucket_client.get_hook.side_effect = ApiError("bad request", code=400)

        self.run_task()

        self.bitbucket_client.create_hook.assert_not_called()
        self.update_config.assert_not_called()
        self.assert_outcome("configuration_error")

    def test_remote_repository_identity_must_match(self) -> None:
        self.bitbucket_client.get_repo.return_value = {"id": 111}

        self.run_task()

        self.bitbucket_client.get_hook.assert_not_called()
        self.bitbucket_client.create_hook.assert_not_called()
        self.update_config.assert_not_called()
        self.assert_outcome("identity_mismatch")

    def test_final_conflict_does_not_delete_updated_hook(self) -> None:
        self.bitbucket_client.get_hook.return_value = {
            "id": 123,
            "name": "hook",
            "url": "https://example.com/hook",
            "active": True,
            "events": [],
        }
        self.update_config.return_value = False

        self.run_task()

        self.bitbucket_client.delete_hook.assert_not_called()
        self.assert_outcome("conflict")

    def test_initialization_race_reuses_winning_secret(self) -> None:
        initial = self.repository
        initial.config = {
            "project": "PROJ",
            "repo": "repository",
            "webhook_id": 123,
        }
        winner = SimpleNamespace(
            id=self.repository_id,
            organization_id=self.organization_id,
            status=ObjectStatus.ACTIVE,
            integration_id=self.integration_id,
            external_id="987",
            config={
                **initial.config,
                "webhook_secret": "winning-secret",
                "webhook_repair_pending": True,
            },
        )
        self.get_repository.side_effect = [initial, initial, winner]
        self.update_config.side_effect = [False, True]
        self.bitbucket_client.get_hook.return_value = {
            "id": 123,
            "name": "hook",
            "url": "https://example.com/hook",
            "active": True,
            "events": [],
        }

        self.run_task()

        assert self.bitbucket_client.update_hook.call_args.args[3]["configuration"] == {
            "secret": "winning-secret"
        }
        self.assert_outcome("updated")

    def test_initialization_race_without_webhook_never_creates(self) -> None:
        initial = self.repository
        initial.config = {
            "project": "PROJ",
            "repo": "repository",
            "webhook_id": 123,
        }
        winner = SimpleNamespace(
            id=self.repository_id,
            organization_id=self.organization_id,
            status=ObjectStatus.ACTIVE,
            integration_id=self.integration_id,
            external_id="987",
            config={
                "project": "PROJ",
                "repo": "repository",
                "webhook_secret": "winning-secret",
                "webhook_repair_pending": True,
            },
        )
        self.get_repository.side_effect = [initial, initial, winner]
        self.update_config.side_effect = [False, True]

        self.run_task()

        self.bitbucket_client.list_hooks.assert_not_called()
        self.bitbucket_client.create_hook.assert_not_called()
        self.bitbucket_client.get_hook.assert_not_called()
        self.assert_outcome("missing_webhook")


@cell_silo_test
class BitbucketWebhookReconciliationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration_id = 10
        self.organization_id = 20
        self.repository_id = 30
        self.repository = SimpleNamespace(
            id=self.repository_id,
            organization_id=self.organization_id,
            status=ObjectStatus.ACTIVE,
            integration_id=self.integration_id,
            external_id="987",
            config={
                "project": "PROJ",
                "repo": "repository",
                "webhook_secret": "existing-secret",
            },
        )
        self.bitbucket_client = MagicMock()
        self.bitbucket_client.get_repo.return_value = {"id": 987}
        self.integration = MagicMock(id=self.integration_id, provider="bitbucket_server")
        self.integration.get_installation.return_value.get_client.return_value = (
            self.bitbucket_client
        )
        self.get_integration = patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.integration_service.get_integration",
            return_value=self.integration,
        ).start()
        self.get_repository = patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.repository_service.get_repository",
            return_value=self.repository,
        ).start()
        self.update_config = patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.repository_service.update_repository_config",
            return_value=True,
        ).start()
        self.get_lock = patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.locks.get"
        ).start()
        self.get_lock.return_value.blocking_acquire.return_value = nullcontext()
        self.addCleanup(patch.stopall)

    def reconcile(self) -> WebhookReconciliationResult:
        return reconcile_repository_webhook(
            integration=self.integration,
            repository=cast(RpcRepository, self.repository),
            mode=WebhookReconciliationMode.ENSURE,
        )

    def test_reloads_repository_after_acquiring_lock(self) -> None:
        inactive_repository = SimpleNamespace(
            **{**self.repository.__dict__, "status": ObjectStatus.DISABLED}
        )
        self.get_repository.return_value = inactive_repository

        result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.INACTIVE
        self.bitbucket_client.get_repo.assert_not_called()

    def test_updates_stored_hook_without_listing(self) -> None:
        self.repository.config["webhook_id"] = 123
        self.bitbucket_client.get_hook.return_value = {
            "id": 123,
            "name": "existing name",
            "url": "https://example.com/existing",
            "active": False,
            "events": ["repo:modified"],
        }

        result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.UPDATED
        self.bitbucket_client.update_hook.assert_called_once_with(
            "PROJ",
            "repository",
            123,
            {
                "name": "existing name",
                "url": "https://example.com/existing",
                "active": False,
                "events": ["repo:modified"],
                "configuration": {"secret": "existing-secret"},
            },
        )
        self.bitbucket_client.list_hooks.assert_not_called()
        self.bitbucket_client.create_hook.assert_not_called()

    def test_creates_marked_hook_after_persisting_identity(self) -> None:
        self.bitbucket_client.list_hooks.return_value = []
        self.bitbucket_client.create_hook.return_value = {"id": 456}

        with patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.uuid4",
            return_value=SimpleNamespace(hex="reconciliation-token"),
        ):
            result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.CREATED
        assert result.webhook_id == 456
        assert result.reconciliation_id == "reconciliation-token"
        assert self.update_config.call_args_list[0].kwargs["config_updates"] == {
            "webhook_reconciliation_id": "reconciliation-token"
        }
        create_data = self.bitbucket_client.create_hook.call_args.args[2]
        assert create_data["name"] == ("sentry-bitbucket-server-repo-hook:reconciliation-token")
        assert create_data["configuration"] == {"secret": "existing-secret"}
        assert self.update_config.call_args_list[1].kwargs["config_updates"] == {"webhook_id": 456}

    def test_initializes_secret_and_identity_before_creating_hook(self) -> None:
        self.repository.config.pop("webhook_secret")
        self.bitbucket_client.list_hooks.return_value = []
        self.bitbucket_client.create_hook.return_value = {"id": 456}

        with (
            patch(
                "sentry.integrations.bitbucket_server.webhook_reconciliation.secrets.token_hex",
                return_value="generated-secret",
            ),
            patch(
                "sentry.integrations.bitbucket_server.webhook_reconciliation.uuid4",
                return_value=SimpleNamespace(hex="reconciliation-token"),
            ),
        ):
            result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.CREATED
        assert self.update_config.call_args_list[0].kwargs["config_updates"] == {
            "webhook_secret": "generated-secret",
            "webhook_repair_pending": True,
        }
        assert self.update_config.call_args_list[1].kwargs["config_updates"] == {
            "webhook_reconciliation_id": "reconciliation-token"
        }
        assert self.bitbucket_client.create_hook.call_args.args[2]["configuration"] == {
            "secret": "generated-secret"
        }

    def test_missing_stored_hook_enters_retry_safe_creation(self) -> None:
        self.repository.config["webhook_id"] = 123
        self.bitbucket_client.get_hook.side_effect = ApiError("missing", code=404)
        self.bitbucket_client.list_hooks.return_value = []
        self.bitbucket_client.create_hook.return_value = {"id": 456}

        with patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.uuid4",
            return_value=SimpleNamespace(hex="reconciliation-token"),
        ):
            result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.CREATED
        assert result.webhook_id == 456
        self.bitbucket_client.list_hooks.assert_called_once_with("PROJ", "repository")

    def test_retry_adopts_exact_marker_after_ambiguous_create(self) -> None:
        self.bitbucket_client.list_hooks.return_value = []
        self.bitbucket_client.create_hook.side_effect = ApiError("timeout", code=500)

        with (
            patch(
                "sentry.integrations.bitbucket_server.webhook_reconciliation.uuid4",
                return_value=SimpleNamespace(hex="reconciliation-token"),
            ),
            pytest.raises(ApiError),
        ):
            self.reconcile()

        self.repository.config["webhook_reconciliation_id"] = "reconciliation-token"
        self.bitbucket_client.create_hook.side_effect = None
        self.bitbucket_client.list_hooks.return_value = [
            {
                "id": 456,
                "name": "sentry-bitbucket-server-repo-hook:reconciliation-token",
                "url": "https://sentry.example.com/webhook",
                "active": True,
                "events": ["repo:refs_changed"],
            }
        ]
        self.update_config.reset_mock()

        result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.ADOPTED
        assert result.webhook_id == 456
        self.bitbucket_client.create_hook.assert_called_once()
        assert self.update_config.call_args.kwargs["config_updates"] == {"webhook_id": 456}

    def test_identity_initialization_race_reuses_winning_marker(self) -> None:
        winner = SimpleNamespace(
            **{
                **self.repository.__dict__,
                "config": {
                    **self.repository.config,
                    "webhook_reconciliation_id": "winning-token",
                },
            }
        )
        self.update_config.side_effect = [False, True]
        self.get_repository.side_effect = [self.repository, winner]
        self.bitbucket_client.list_hooks.return_value = [
            {
                "id": 456,
                "name": "sentry-bitbucket-server-repo-hook:winning-token",
            }
        ]

        result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.ADOPTED
        assert result.reconciliation_id == "winning-token"
        self.bitbucket_client.create_hook.assert_not_called()

    def test_identity_initialization_race_keeps_winning_webhook(self) -> None:
        winner = SimpleNamespace(
            **{
                **self.repository.__dict__,
                "config": {
                    **self.repository.config,
                    "webhook_id": 456,
                    "webhook_reconciliation_id": "winning-token",
                },
            }
        )
        self.update_config.side_effect = [False, True]
        self.get_repository.side_effect = [self.repository, winner]
        self.bitbucket_client.get_hook.return_value = {
            "id": 456,
            "name": "sentry-bitbucket-server-repo-hook:winning-token",
            "url": "https://sentry.example.com/webhook",
            "active": True,
            "events": ["repo:refs_changed"],
        }

        result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.UPDATED
        assert result.webhook_id == 456
        self.bitbucket_client.list_hooks.assert_not_called()
        self.bitbucket_client.create_hook.assert_not_called()

    def test_only_exact_marker_is_adopted(self) -> None:
        self.repository.config["webhook_reconciliation_id"] = "reconciliation-token"
        self.bitbucket_client.list_hooks.return_value = [
            {
                "id": 111,
                "name": "sentry-bitbucket-server-repo-hook",
                "url": "https://sentry.example.com/webhook",
                "active": True,
                "events": [],
            },
            {
                "id": 222,
                "name": "sentry-bitbucket-server-repo-hook:another-token",
                "url": "https://sentry.example.com/webhook",
                "active": True,
                "events": [],
            },
        ]
        self.bitbucket_client.create_hook.return_value = {"id": 456}

        result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.CREATED
        assert result.webhook_id == 456

    def test_multiple_exact_markers_choose_lowest_id_and_cleanup_others(self) -> None:
        self.repository.config["webhook_reconciliation_id"] = "reconciliation-token"
        marker = "sentry-bitbucket-server-repo-hook:reconciliation-token"
        self.bitbucket_client.list_hooks.return_value = [
            {"id": 456, "name": marker},
            {"id": 123, "name": marker},
            {"id": 789, "name": marker},
        ]

        result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.ADOPTED
        assert result.webhook_id == 123
        assert result.cleanup_webhook_ids == (456, 789)
        self.bitbucket_client.update_hook.assert_called_once()
        assert self.bitbucket_client.update_hook.call_args.args[2] == 123

    def test_persistence_conflict_schedules_selected_hook_cleanup(self) -> None:
        self.bitbucket_client.list_hooks.return_value = []
        self.bitbucket_client.create_hook.return_value = {"id": 456}
        self.update_config.side_effect = [True, False]

        with patch(
            "sentry.integrations.bitbucket_server.webhook_reconciliation.uuid4",
            return_value=SimpleNamespace(hex="reconciliation-token"),
        ):
            result = self.reconcile()

        assert result.outcome == WebhookReconciliationOutcome.CONFLICT
        assert result.cleanup_webhook_ids == (456,)
        assert result.reconciliation_id == "reconciliation-token"

    def test_cleanup_verifies_marker_before_deleting(self) -> None:
        self.bitbucket_client.get_hook.return_value = {
            "id": 456,
            "name": "sentry-bitbucket-server-repo-hook:reconciliation-token",
        }

        result = cleanup_repository_webhook(
            integration=self.integration,
            organization_id=self.organization_id,
            repository_id=self.repository_id,
            project="PROJ",
            repository_slug="repository",
            webhook_id=456,
            reconciliation_id="reconciliation-token",
        )

        assert result.outcome == WebhookReconciliationOutcome.CLEANED_UP
        self.bitbucket_client.delete_hook.assert_called_once_with("PROJ", "repository", 456)

    def test_cleanup_does_not_delete_mismatched_or_tracked_hook(self) -> None:
        self.bitbucket_client.get_hook.return_value = {
            "id": 456,
            "name": "sentry-bitbucket-server-repo-hook:another-token",
        }

        result = cleanup_repository_webhook(
            integration=self.integration,
            organization_id=self.organization_id,
            repository_id=self.repository_id,
            project="PROJ",
            repository_slug="repository",
            webhook_id=456,
            reconciliation_id="reconciliation-token",
        )

        assert result.outcome == WebhookReconciliationOutcome.CONFLICT
        self.bitbucket_client.delete_hook.assert_not_called()

        self.repository.config["webhook_id"] = 456
        result = cleanup_repository_webhook(
            integration=self.integration,
            organization_id=self.organization_id,
            repository_id=self.repository_id,
            project="PROJ",
            repository_slug="repository",
            webhook_id=456,
            reconciliation_id="reconciliation-token",
        )

        assert result.outcome == WebhookReconciliationOutcome.CLEANUP_SKIPPED
        self.bitbucket_client.get_hook.assert_called_once()

    def test_cleanup_rechecks_tracked_hook_before_deleting(self) -> None:
        tracked_repository = SimpleNamespace(
            **{
                **self.repository.__dict__,
                "config": {**self.repository.config, "webhook_id": 456},
            }
        )
        self.get_repository.side_effect = [self.repository, tracked_repository]
        self.bitbucket_client.get_hook.return_value = {
            "id": 456,
            "name": "sentry-bitbucket-server-repo-hook:reconciliation-token",
        }

        result = cleanup_repository_webhook(
            integration=self.integration,
            organization_id=self.organization_id,
            repository_id=self.repository_id,
            project="PROJ",
            repository_slug="repository",
            webhook_id=456,
            reconciliation_id="reconciliation-token",
        )

        assert result.outcome == WebhookReconciliationOutcome.CLEANUP_SKIPPED
        self.bitbucket_client.delete_hook.assert_not_called()
