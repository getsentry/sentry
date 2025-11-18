import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip
class BackfillMonitorEnvironmentIsMutedTest(TestMigrations):
    migrate_from = "0010_delete_orphaned_detectors"
    migrate_to = "0011_backfill_monitor_environment_is_muted"
    app = "monitors"
    connection = "secondary"

    def setup_initial_state(self) -> None:
        # Create muted monitor with environments
        self.muted_monitor = self.create_monitor(name="Muted Monitor", is_muted=True)
        self.muted_env1 = self.create_monitor_environment(
            monitor=self.muted_monitor,
            environment_id=self.environment.id,
            is_muted=False,  # Initially not muted
        )
        env2 = self.create_environment(name="production", project=self.project)
        self.muted_env2 = self.create_monitor_environment(
            monitor=self.muted_monitor,
            environment_id=env2.id,
            is_muted=False,  # Initially not muted
        )

        # Create unmuted monitor with environments
        self.unmuted_monitor = self.create_monitor(name="Unmuted Monitor", is_muted=False)
        self.unmuted_env1 = self.create_monitor_environment(
            monitor=self.unmuted_monitor,
            environment_id=self.environment.id,
            is_muted=False,
        )
        env3 = self.create_environment(name="staging", project=self.project)
        self.unmuted_env2 = self.create_monitor_environment(
            monitor=self.unmuted_monitor,
            environment_id=env3.id,
            is_muted=False,
        )

        # Create muted monitor without environments
        self.muted_monitor_no_envs = self.create_monitor(
            name="Muted Monitor No Envs", is_muted=True
        )

        # Verify initial state
        assert self.muted_monitor.is_muted is True
        assert self.muted_env1.is_muted is False
        assert self.muted_env2.is_muted is False
        assert self.unmuted_monitor.is_muted is False
        assert self.unmuted_env1.is_muted is False
        assert self.unmuted_env2.is_muted is False

    def test(self) -> None:
        # Refresh from DB to get updated state after migration
        self.muted_monitor.refresh_from_db()
        self.muted_env1.refresh_from_db()
        self.muted_env2.refresh_from_db()
        self.unmuted_monitor.refresh_from_db()
        self.unmuted_env1.refresh_from_db()
        self.unmuted_env2.refresh_from_db()
        self.muted_monitor_no_envs.refresh_from_db()

        # Verify muted monitor has all environments muted
        assert self.muted_monitor.is_muted is True
        assert self.muted_env1.is_muted is True
        assert self.muted_env2.is_muted is True

        # Verify unmuted monitor environments remain unchanged
        assert self.unmuted_monitor.is_muted is False
        assert self.unmuted_env1.is_muted is False
        assert self.unmuted_env2.is_muted is False

        # Verify muted monitor without environments still muted
        assert self.muted_monitor_no_envs.is_muted is True
