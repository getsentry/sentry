from sentry.testutils.cases import TestMigrations


class BackfillNightShiftResultIdempotencyKeyTest(TestMigrations):
    app = "seer"
    migrate_from = "0026_add_night_shift_result_idempotency_key"
    migrate_to = "0027_backfill_night_shift_result_idempotency_key"

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

        # Duplicate pair: the first row must survive (backfilled), the second must go.
        self.kept = create_result(run.id, self.group.id)
        self.dupe = create_result(run.id, self.group.id)
        # Same group on a different run, and a different group on the same run:
        # not duplicates, both must survive and get backfilled.
        self.other_run_result = create_result(other_run.id, self.group.id)
        self.other_group_result = create_result(run.id, self.other_group.id)
        # Group-less rows have nothing to backfill from and are left alone.
        self.groupless_a = create_result(run.id, None)
        self.groupless_b = create_result(run.id, None)

    def test_backfill_and_dedupe(self):
        from sentry.seer.models.night_shift import SeerNightShiftRunResult

        remaining = {r.id: r for r in SeerNightShiftRunResult.objects.all()}
        assert self.dupe.id not in remaining
        assert set(remaining) == {
            self.kept.id,
            self.other_run_result.id,
            self.other_group_result.id,
            self.groupless_a.id,
            self.groupless_b.id,
        }

        assert remaining[self.kept.id].idempotency_key == str(self.group.id)
        assert remaining[self.other_run_result.id].idempotency_key == str(self.group.id)
        assert remaining[self.other_group_result.id].idempotency_key == str(self.other_group.id)
        assert remaining[self.groupless_a.id].idempotency_key is None
        assert remaining[self.groupless_b.id].idempotency_key is None
