from sentry.testutils.cases import TestMigrations


class DedupeNightShiftRunResultsTest(TestMigrations):
    app = "seer"
    migrate_from = "0025_add_seerrun_referrer_index"
    migrate_to = "0026_dedupe_night_shift_run_results"

    def setup_before_migration(self, apps):
        SeerNightShiftRun = apps.get_model("seer", "SeerNightShiftRun")
        SeerNightShiftRunResult = apps.get_model("seer", "SeerNightShiftRunResult")

        org = self.create_organization()
        project = self.create_project(organization=org)
        self.group = self.create_group(project=project)
        self.other_group = self.create_group(project=project)

        run = SeerNightShiftRun.objects.create(organization_id=org.id, extras={})
        other_run = SeerNightShiftRun.objects.create(organization_id=org.id, extras={})

        def create_result(run_id: int, group_id: int | None):
            return SeerNightShiftRunResult.objects.create(
                run_id=run_id, kind="agentic_triage", group_id=group_id, extras={}
            )

        # Duplicate pair: the first row must survive, the second must go.
        self.kept = create_result(run.id, self.group.id)
        self.dupe = create_result(run.id, self.group.id)
        # Same group on a different run, and a different group on the same run:
        # not duplicates, both must survive.
        self.other_run_result = create_result(other_run.id, self.group.id)
        self.other_group_result = create_result(run.id, self.other_group.id)
        # Group-less rows are outside the constraint and must be untouched.
        self.groupless_a = create_result(run.id, None)
        self.groupless_b = create_result(run.id, None)

    def test_dedupe(self):
        from sentry.seer.models.night_shift import SeerNightShiftRunResult

        remaining_ids = set(SeerNightShiftRunResult.objects.values_list("id", flat=True))
        assert self.dupe.id not in remaining_ids
        assert remaining_ids == {
            self.kept.id,
            self.other_run_result.id,
            self.other_group_result.id,
            self.groupless_a.id,
            self.groupless_b.id,
        }
