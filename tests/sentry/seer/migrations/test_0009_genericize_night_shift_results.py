from django.db.migrations.state import StateApps

from sentry.testutils.cases import TestMigrations


class GenericizeNightShiftResultsMigrationTest(TestMigrations):
    migrate_from = "0008_add_seer_run_models"
    migrate_to = "0009_genericize_night_shift_results"
    app = "seer"

    def setup_initial_state(self) -> None:
        self.group = self.create_group()

    def setup_before_migration(self, apps: StateApps) -> None:
        SeerNightShiftRun = apps.get_model("seer", "SeerNightShiftRun")
        SeerNightShiftRunIssue = apps.get_model("seer", "SeerNightShiftRunIssue")

        run = SeerNightShiftRun.objects.create(
            organization_id=self.organization.id,
            triage_strategy="agentic_triage",
        )
        autofix_row = SeerNightShiftRunIssue.objects.create(
            run_id=run.id,
            group_id=self.group.id,
            action="autofix",
            seer_run_id="seer-1",
        )
        root_cause_row = SeerNightShiftRunIssue.objects.create(
            run_id=run.id,
            group_id=self.group.id,
            action="root_cause_only",
            seer_run_id="seer-2",
        )
        self.run_id = run.id
        self.autofix_row_id = autofix_row.id
        self.root_cause_row_id = root_cause_row.id

        # A second run that recorded a failure on the legacy error_message
        # column, to verify the per-row error_message backfill into extras.
        self.failed_error_message = "No Seer quota available"
        failed_run = SeerNightShiftRun.objects.create(
            organization_id=self.organization.id,
            triage_strategy="agentic_triage",
            error_message=self.failed_error_message,
        )
        self.failed_run_id = failed_run.id

    def test(self) -> None:
        from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunResult

        autofix_row = SeerNightShiftRunResult.objects.get(id=self.autofix_row_id)
        assert autofix_row.kind == "agentic_triage"
        assert autofix_row.extras == {"action": "autofix"}
        assert autofix_row.seer_run_id == "seer-1"

        root_cause_row = SeerNightShiftRunResult.objects.get(id=self.root_cause_row_id)
        assert root_cause_row.kind == "agentic_triage"
        assert root_cause_row.extras == {"action": "root_cause_only"}
        assert root_cause_row.seer_run_id == "seer-2"

        # Run with no error_message keeps an empty (or near-empty) extras.
        ok_run = SeerNightShiftRun.objects.get(id=self.run_id)
        assert "error_message" not in (ok_run.extras or {})

        # Run with a recorded error has it preserved in extras.
        failed_run = SeerNightShiftRun.objects.get(id=self.failed_run_id)
        assert failed_run.extras["error_message"] == self.failed_error_message
