import importlib
from concurrent.futures import Future
from unittest import mock

import pytest
from django.db import connections

from sentry.testutils.cases import TestMigrations

migration = importlib.import_module("sentry.migrations.1249_backfill_group_action_log")


class BackfillGroupActionLogTest(TestMigrations):
    migrate_from = "1248_add_dashboard_non_user_creator"
    migrate_to = "1249_backfill_group_action_log"

    def setUp(self):
        self.delivery: Future[None] = Future()
        self.delivery.set_result(None)
        with mock.patch.object(
            migration.enroll_projects_for_group_action_log_backfill,
            "apply_async_with_future",
            return_value=self.delivery,
        ) as self.dispatch:
            super().setUp()

    def setup_initial_state(self):
        self.legacy = self.create_project()

    def setup_before_migration(self, apps):
        ProjectOption = apps.get_model("sentry", "ProjectOption")
        ProjectOption.objects.filter(project_id=self.legacy.id, key="sentry:option-epoch").update(
            value=15
        )

    def test_starts_enrollment_and_backfill(self):
        self.dispatch.assert_called_once_with(
            kwargs={"chain_backfill": True},
            headers={"sentry-propagate-traces": False},
        )
        ProjectOption = self.apps.get_model("sentry", "ProjectOption")
        assert not ProjectOption.objects.filter(
            project_id=self.legacy.id,
            key="sentry:group_action_log_backfill_completed",
        ).exists()

        failed_delivery: Future[None] = Future()
        failed_delivery.set_exception(RuntimeError("Kafka delivery failed"))
        with (
            connections[self.connection].schema_editor() as editor,
            mock.patch.object(
                migration.enroll_projects_for_group_action_log_backfill,
                "apply_async_with_future",
                return_value=failed_delivery,
            ),
            pytest.raises(RuntimeError, match="Kafka delivery failed"),
        ):
            migration.backfill_group_action_log(self.apps, editor)

        with (
            connections[self.connection].schema_editor() as editor,
            mock.patch.object(
                migration.enroll_projects_for_group_action_log_backfill,
                "apply_async_with_future",
                return_value=self.delivery,
            ) as dispatch,
        ):
            migration.backfill_group_action_log(self.apps, editor)
        dispatch.assert_called_once_with(
            kwargs={"chain_backfill": True},
            headers={"sentry-propagate-traces": False},
        )

        Project = self.apps.get_model("sentry", "Project")
        Project.objects.all().update(status=1)
        with (
            connections[self.connection].schema_editor() as editor,
            mock.patch.object(
                migration.enroll_projects_for_group_action_log_backfill, "apply_async_with_future"
            ) as dispatch,
        ):
            migration.backfill_group_action_log(self.apps, editor)
        dispatch.assert_not_called()
