from sentry.testutils.cases import TestMigrations


class BackfillCustomInboundFiltersFromLegacyListsTest(TestMigrations):
    app = "sentry"
    migrate_from = "1180_release_swap_new_last_deploy_id"
    migrate_to = "1181_backfill_custom_inbound_filters_from_legacy_lists"

    def setup_initial_state(self):
        self.organization = self.create_organization()
        self.full = self.create_project(organization=self.organization)
        self.empty_lists = self.create_project(organization=self.organization)
        self.already_migrated = self.create_project(organization=self.organization)
        self.untouched = self.create_project(organization=self.organization)
        self.only_comments = self.create_project(organization=self.organization)
        self.malformed = self.create_project(organization=self.organization)

    def setup_before_migration(self, apps):
        ProjectOption = apps.get_model("sentry", "ProjectOption")
        CustomInboundFilter = apps.get_model("sentry", "CustomInboundFilter")

        def option(project, key, value):
            ProjectOption.objects.create(project_id=project.id, key=key, value=value)

        # Every legacy list at once, with whitespace, a duplicate and a comment line
        # that must not end up in the active filter.
        option(self.full, "sentry:releases", ["1.*", " 2.0.0 ", "1.*", "", "# 3.*"])
        option(self.full, "sentry:error_messages", ["TypeError: Cannot read*", "*timeout*"])
        option(self.full, "sentry:log_messages", ["*DEBUG*"])
        option(self.full, "sentry:trace_metric_names", ["checkout.*"])
        # A project option that is not a legacy filter list is left alone.
        option(self.full, "sentry:resolve_age", 24)

        # Lists that hold nothing produce no filter.
        option(self.empty_lists, "sentry:releases", [])
        option(self.empty_lists, "sentry:error_messages", ["   ", ""])

        # The row the migration would create is already there, so a rerun or a
        # project a later step already wrote must not get a second copy.
        option(self.already_migrated, "sentry:releases", ["1.*"])
        self.existing = CustomInboundFilter.objects.create(
            project_id=self.already_migrated.id,
            name="My own name",
            active=False,
            data_type="all",
            conditions=[{"type": "release", "value": ["1.*"]}],
        )
        # A filter the user built themselves stays as it is.
        self.user_filter = CustomInboundFilter.objects.create(
            project_id=self.already_migrated.id,
            name="Mine",
            active=True,
            data_type="error",
            conditions=[{"type": "error_type", "value": ["TypeError"]}],
        )

        option(self.only_comments, "sentry:log_messages", ["# *DEBUG*", "#"])

        # Values the option field can hold but a filter list never should.
        option(self.malformed, "sentry:releases", "1.*")
        option(self.malformed, "sentry:error_messages", ["ok*", 42, None])

    def test_backfill(self):
        CustomInboundFilter = self.apps.get_model("sentry", "CustomInboundFilter")

        def filters_of(project):
            return [
                {
                    "name": f.name,
                    "active": f.active,
                    "data_type": f.data_type,
                    "conditions": f.conditions,
                }
                for f in CustomInboundFilter.objects.filter(project_id=project.id).order_by("id")
            ]

        assert filters_of(self.full) == [
            {
                "name": "Releases",
                "active": True,
                "data_type": "all",
                "conditions": [{"type": "release", "value": ["1.*", "2.0.0"]}],
            },
            {
                "name": "Releases (disabled)",
                "active": False,
                "data_type": "all",
                "conditions": [{"type": "release", "value": ["3.*"]}],
            },
            {
                "name": "Error Messages",
                "active": True,
                "data_type": "error",
                "conditions": [
                    {"type": "error_message", "value": ["TypeError: Cannot read*", "*timeout*"]}
                ],
            },
            {
                "name": "Log Messages",
                "active": True,
                "data_type": "log",
                "conditions": [{"type": "log_message", "value": ["*DEBUG*"]}],
            },
            {
                "name": "Metric Names",
                "active": True,
                "data_type": "metric",
                "conditions": [{"type": "metric_name", "value": ["checkout.*"]}],
            },
        ]

        assert filters_of(self.empty_lists) == []
        assert filters_of(self.untouched) == []

        assert [f["name"] for f in filters_of(self.already_migrated)] == ["My own name", "Mine"]
        self.existing.refresh_from_db()
        assert self.existing.active is False

        assert filters_of(self.only_comments) == [
            {
                "name": "Log Messages (disabled)",
                "active": False,
                "data_type": "log",
                "conditions": [{"type": "log_message", "value": ["*DEBUG*"]}],
            }
        ]

        assert filters_of(self.malformed) == [
            {
                "name": "Error Messages",
                "active": True,
                "data_type": "error",
                "conditions": [{"type": "error_message", "value": ["ok*"]}],
            }
        ]

        # The legacy lists stay in place: Relay keeps applying them until a later
        # step switches a project over to the rows.
        ProjectOption = self.apps.get_model("sentry", "ProjectOption")
        assert ProjectOption.objects.get(project_id=self.full.id, key="sentry:releases").value == [
            "1.*",
            " 2.0.0 ",
            "1.*",
            "",
            "# 3.*",
        ]
