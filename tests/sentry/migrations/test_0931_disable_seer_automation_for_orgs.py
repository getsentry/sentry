from sentry.testutils.cases import TestMigrations


class DisableSeerAutomationForOrgsTest(TestMigrations):
    app = "sentry"
    migrate_from = "0930_make_open_period_range_boundary_inclusive"
    migrate_to = "0931_disable_seer_automation_for_orgs"

    def setup_initial_state(self):
        # Create organizations - some with target IDs, some without
        # Use the first few IDs from the migration's TARGET_ORGANIZATION_IDS list
        target_org_id = 16893  # First ID from the list
        non_target_org_id = 999999  # ID not in the target list

        self.target_org = self.create_organization(id=target_org_id, slug="target-org")
        self.non_target_org = self.create_organization(id=non_target_org_id, slug="non-target-org")

        # Create projects for both organizations
        self.target_project1 = self.create_project(
            organization=self.target_org, slug="target-project-1"
        )
        self.target_project2 = self.create_project(
            organization=self.target_org, slug="target-project-2"
        )
        self.non_target_project = self.create_project(
            organization=self.non_target_org, slug="non-target-project"
        )

        # Set up organization options with various initial values
        from sentry.models.options.organization_option import OrganizationOption

        # Target org - should be updated (False/None values)
        OrganizationOption.objects.create(
            organization=self.target_org, key="sentry:default_seer_scanner_automation", value=False
        )
        OrganizationOption.objects.create(
            organization=self.target_org,
            key="sentry:default_autofix_automation_tuning",
            value=None,
        )

        # Non-target org - should NOT be updated (even with False/None values)
        OrganizationOption.objects.create(
            organization=self.non_target_org,
            key="sentry:default_seer_scanner_automation",
            value=False,
        )
        OrganizationOption.objects.create(
            organization=self.non_target_org,
            key="sentry:default_autofix_automation_tuning",
            value=None,
        )

        # Set up project options with various initial values
        from sentry.models.options.project_option import ProjectOption

        # Target project 1 - should be updated (False/None values)
        ProjectOption.objects.create(
            project=self.target_project1, key="sentry:seer_scanner_automation", value=False
        )
        ProjectOption.objects.create(
            project=self.target_project1, key="sentry:autofix_automation_tuning", value=None
        )

        # Target project 2 - should be updated (None/False values)
        ProjectOption.objects.create(
            project=self.target_project2, key="sentry:seer_scanner_automation", value=None
        )
        ProjectOption.objects.create(
            project=self.target_project2, key="sentry:autofix_automation_tuning", value=False
        )

        # Non-target project - should NOT be updated
        ProjectOption.objects.create(
            project=self.non_target_project, key="sentry:seer_scanner_automation", value=False
        )
        ProjectOption.objects.create(
            project=self.non_target_project, key="sentry:autofix_automation_tuning", value=None
        )

    def test(self):
        from sentry.models.options.organization_option import OrganizationOption
        from sentry.models.options.project_option import ProjectOption

        # Check target organization options were updated
        target_org_scanner = OrganizationOption.objects.get(
            organization=self.target_org, key="sentry:default_seer_scanner_automation"
        )
        assert target_org_scanner.value is False

        target_org_autofix = OrganizationOption.objects.get(
            organization=self.target_org, key="sentry:default_autofix_automation_tuning"
        )
        assert target_org_autofix.value == "off"

        # Check non-target organization options were NOT updated
        non_target_org_scanner = OrganizationOption.objects.get(
            organization=self.non_target_org, key="sentry:default_seer_scanner_automation"
        )
        assert non_target_org_scanner.value is False  # Should remain False

        non_target_org_autofix = OrganizationOption.objects.get(
            organization=self.non_target_org, key="sentry:default_autofix_automation_tuning"
        )
        assert non_target_org_autofix.value is None  # Should remain None

        # Check target project 1 options were updated
        target_proj1_scanner = ProjectOption.objects.get(
            project=self.target_project1, key="sentry:seer_scanner_automation"
        )
        assert target_proj1_scanner.value is False

        target_proj1_autofix = ProjectOption.objects.get(
            project=self.target_project1, key="sentry:autofix_automation_tuning"
        )
        assert target_proj1_autofix.value == "off"

        # Check target project 2 options were updated
        target_proj2_scanner = ProjectOption.objects.get(
            project=self.target_project2, key="sentry:seer_scanner_automation"
        )
        assert target_proj2_scanner.value is False

        target_proj2_autofix = ProjectOption.objects.get(
            project=self.target_project2, key="sentry:autofix_automation_tuning"
        )
        assert target_proj2_autofix.value == "off"

        # Check non-target project options were NOT updated
        non_target_proj_scanner = ProjectOption.objects.get(
            project=self.non_target_project, key="sentry:seer_scanner_automation"
        )
        assert non_target_proj_scanner.value is False  # Should remain False

        non_target_proj_autofix = ProjectOption.objects.get(
            project=self.non_target_project, key="sentry:autofix_automation_tuning"
        )
        assert non_target_proj_autofix.value is None  # Should remain None


class DisableSeerAutomationForOrgsSkipExistingTest(TestMigrations):
    """Test that the migration skips organizations and projects that already have enabled settings"""

    app = "sentry"
    migrate_from = "0930_make_open_period_range_boundary_inclusive"
    migrate_to = "0931_disable_seer_automation_for_orgs"

    def setup_initial_state(self):
        # Use second target ID from the migration list
        target_org_id = 17008

        self.target_org = self.create_organization(id=target_org_id, slug="target-org-skip")
        self.target_project = self.create_project(
            organization=self.target_org, slug="target-project-skip"
        )

        # Set up organization options with values that should NOT be changed
        from sentry.models.options.organization_option import OrganizationOption

        OrganizationOption.objects.create(
            organization=self.target_org,
            key="sentry:default_seer_scanner_automation",
            value=True,  # Should NOT be changed
        )
        OrganizationOption.objects.create(
            organization=self.target_org,
            key="sentry:default_autofix_automation_tuning",
            value="on",  # Should NOT be changed
        )

        # Set up project options with values that should NOT be changed
        from sentry.models.options.project_option import ProjectOption

        ProjectOption.objects.create(
            project=self.target_project,
            key="sentry:seer_scanner_automation",
            value=True,  # Should NOT be changed
        )
        ProjectOption.objects.create(
            project=self.target_project,
            key="sentry:autofix_automation_tuning",
            value="on",  # Should NOT be changed
        )

    def test(self):
        from sentry.models.options.organization_option import OrganizationOption
        from sentry.models.options.project_option import ProjectOption

        # Check organization options were NOT changed
        target_org_scanner = OrganizationOption.objects.get(
            organization=self.target_org, key="sentry:default_seer_scanner_automation"
        )
        assert target_org_scanner.value is True  # Should remain True

        target_org_autofix = OrganizationOption.objects.get(
            organization=self.target_org, key="sentry:default_autofix_automation_tuning"
        )
        assert target_org_autofix.value == "on"  # Should remain "on"

        # Check project options were NOT changed
        target_proj_scanner = ProjectOption.objects.get(
            project=self.target_project, key="sentry:seer_scanner_automation"
        )
        assert target_proj_scanner.value is True  # Should remain True

        target_proj_autofix = ProjectOption.objects.get(
            project=self.target_project, key="sentry:autofix_automation_tuning"
        )
        assert target_proj_autofix.value == "on"  # Should remain "on"


class DisableSeerAutomationForOrgsNoExistingOptionsTest(TestMigrations):
    """Test that the migration creates new options when none exist"""

    app = "sentry"
    migrate_from = "0930_make_open_period_range_boundary_inclusive"
    migrate_to = "0931_disable_seer_automation_for_orgs"

    def setup_initial_state(self):
        # Use third target ID from the migration list
        target_org_id = 21810

        self.target_org = self.create_organization(id=target_org_id, slug="target-org-no-options")
        self.target_project = self.create_project(
            organization=self.target_org, slug="target-project-no-options"
        )

        # Don't create any options - test that migration creates them

    def test(self):
        from sentry.models.options.organization_option import OrganizationOption
        from sentry.models.options.project_option import ProjectOption

        # Check that new organization options were created
        target_org_scanner = OrganizationOption.objects.get(
            organization=self.target_org, key="sentry:default_seer_scanner_automation"
        )
        assert target_org_scanner.value is False

        target_org_autofix = OrganizationOption.objects.get(
            organization=self.target_org, key="sentry:default_autofix_automation_tuning"
        )
        assert target_org_autofix.value == "off"

        # Check that new project options were created
        target_proj_scanner = ProjectOption.objects.get(
            project=self.target_project, key="sentry:seer_scanner_automation"
        )
        assert target_proj_scanner.value is False

        target_proj_autofix = ProjectOption.objects.get(
            project=self.target_project, key="sentry:autofix_automation_tuning"
        )
        assert target_proj_autofix.value == "off"
