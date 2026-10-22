from sentry.testutils.cases import TestMigrations


class BackfillCustomInboundFilterLegacyListsTest(TestMigrations):
    app = "sentry"
    migrate_from = "1198_prepare_incidentactivity_retirement"
    migrate_to = "1199_backfill_custominboundfilter_legacy_lists"

    def setup_initial_state(self):
        self.other_project = self.create_project(organization=self.organization)

    def setup_before_migration(self, apps):
        ProjectOption = apps.get_model("sentry", "ProjectOption")
        CustomInboundFilter = apps.get_model("sentry", "CustomInboundFilter")

        ProjectOption.objects.create(
            project_id=self.project.id,
            key="sentry:releases",
            value=["1.0.*", "# staging builds", "2.0-rc*"],
        )
        ProjectOption.objects.create(
            project_id=self.project.id,
            key="sentry:error_messages",
            value=["TypeError*", "ChunkLoadError*"],
        )
        ProjectOption.objects.create(
            project_id=self.project.id, key="sentry:log_messages", value=[]
        )
        ProjectOption.objects.create(
            project_id=self.project.id,
            key="sentry:trace_metric_names",
            value=["checkout.*"],
        )
        ProjectOption.objects.create(
            project_id=self.other_project.id,
            key="sentry:trace_metric_names",
            value=["cart.*"],
        )

        self.stale_row = CustomInboundFilter.objects.create(
            project_id=self.project.id,
            name="My errors",
            active=False,
            data_type="error",
            conditions=[{"type": "error_message", "value": ["OldError*"]}],
            legacy_filter="error-message",
        )
        self.current_row = CustomInboundFilter.objects.create(
            project_id=self.project.id,
            name="Metric Names",
            data_type="metric",
            conditions=[{"type": "metric_name", "value": ["checkout.*"]}],
            legacy_filter="trace-metric-name",
        )
        self.user_row = CustomInboundFilter.objects.create(
            project_id=self.project.id,
            name="Noisy release",
            data_type="all",
            conditions=[{"type": "release", "value": ["3.*"]}],
        )

    def test_backfill(self):
        CustomInboundFilter = self.apps.get_model("sentry", "CustomInboundFilter")

        def rows(project_id):
            return {
                row.legacy_filter: row
                for row in CustomInboundFilter.objects.filter(project_id=project_id)
            }

        project_rows = rows(self.project.id)
        assert set(project_rows) == {None, "release-version", "error-message", "trace-metric-name"}

        releases = project_rows["release-version"]
        assert releases.name == "Releases"
        assert releases.active is True
        assert releases.data_type == "all"
        assert releases.conditions == [
            {"type": "release", "value": ["1.0.*", "# staging builds", "2.0-rc*"]}
        ]

        errors = project_rows["error-message"]
        assert errors.id == self.stale_row.id
        assert errors.name == "My errors"
        assert errors.active is False
        assert errors.conditions == [
            {"type": "error_message", "value": ["TypeError*", "ChunkLoadError*"]}
        ]

        metrics = project_rows["trace-metric-name"]
        assert metrics.id == self.current_row.id
        assert metrics.conditions == [{"type": "metric_name", "value": ["checkout.*"]}]

        user_row = project_rows[None]
        assert user_row.id == self.user_row.id
        assert user_row.conditions == [{"type": "release", "value": ["3.*"]}]

        other_rows = rows(self.other_project.id)
        assert set(other_rows) == {"trace-metric-name"}
        assert other_rows["trace-metric-name"].data_type == "metric"
        assert other_rows["trace-metric-name"].conditions == [
            {"type": "metric_name", "value": ["cart.*"]}
        ]
