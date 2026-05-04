from sentry.testutils.cases import TestMigrations


class GenericizeNightShiftResultsMigrationTest(TestMigrations):
    migrate_from = "0008_add_seer_run_models"
    migrate_to = "0009_genericize_night_shift_results"
    app = "seer"

    def setup_initial_state(self) -> None:
        self.group = self.create_group()

    def setup_before_migration(self, apps) -> None:
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
        self.autofix_row_id = autofix_row.id
        self.root_cause_row_id = root_cause_row.id

    def test(self) -> None:
        from sentry.seer.models.night_shift import SeerNightShiftRunResult

        autofix_row = SeerNightShiftRunResult.objects.get(id=self.autofix_row_id)
        assert autofix_row.kind == "agentic_triage"
        assert autofix_row.extras == {"action": "autofix"}
        assert autofix_row.seer_run_id == "seer-1"

        root_cause_row = SeerNightShiftRunResult.objects.get(id=self.root_cause_row_id)
        assert root_cause_row.kind == "agentic_triage"
        assert root_cause_row.extras == {"action": "root_cause_only"}
        assert root_cause_row.seer_run_id == "seer-2"
