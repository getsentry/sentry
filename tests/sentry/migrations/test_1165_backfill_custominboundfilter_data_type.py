from sentry.testutils.cases import TestMigrations


class BackfillCustomInboundFilterDataTypeTest(TestMigrations):
    app = "sentry"
    migrate_from = "1164_custominboundfilter_add_data_type"
    migrate_to = "1165_backfill_custominboundfilter_data_type"

    def setup_before_migration(self, apps):
        CustomInboundFilter = apps.get_model("sentry", "CustomInboundFilter")

        self.log = CustomInboundFilter.objects.create(
            project_id=self.project.id,
            name="Log filter",
            conditions=[{"type": "log_message", "value": ["Rate limit*"]}],
        )
        self.metric = CustomInboundFilter.objects.create(
            project_id=self.project.id,
            name="Metric filter",
            conditions=[
                {"type": "release", "value": ["1.*"]},
                {"type": "metric_name", "value": ["checkout.*"]},
            ],
        )
        self.error = CustomInboundFilter.objects.create(
            project_id=self.project.id,
            name="Error filter",
            conditions=[{"type": "error_message", "value": ["TypeError*"]}],
        )
        self.release_only = CustomInboundFilter.objects.create(
            project_id=self.project.id,
            name="Release filter",
            conditions=[{"type": "release", "value": ["1.*"]}],
        )

    def test_backfill(self):
        for custom_filter in (self.log, self.metric, self.error, self.release_only):
            custom_filter.refresh_from_db()

        assert self.log.data_type == "log"
        assert self.metric.data_type == "metric"
        assert self.error.data_type == "error"
        # A release-only filter used to fall through to errors, so it keeps matching
        # errors alone. Widening it to the catch-all is the owner's decision.
        assert self.release_only.data_type == "error"
