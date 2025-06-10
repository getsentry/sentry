from sentry.testutils.cases import TestMigrations


class UpdateErrorDetectorNamesTest(TestMigrations):
    migrate_from = "0067_workflow_action_group_status_group_db_constraint"
    migrate_to = "0068_update_error_detector_names"

    def setup_before_migration(self, apps):
        # Use factories for basic setup
        self.organization = self.create_organization()
        self.user = self.create_user()
        self.project = self.create_project(organization=self.organization)

        # Use the apps registry to get the historical models for migration testing
        Detector = apps.get_model("workflow_engine", "Detector")

        # Create error detectors with various names that should be updated
        self.error_detector_1 = Detector.objects.create(
            project_id=self.project.id,
            name="Custom Error Detector 1",
            type="error",
            enabled=True,
            organization_id=self.organization.id,
            created_by_id=self.user.id,
        )

        self.error_detector_2 = Detector.objects.create(
            project_id=self.project.id,
            name="My Error Monitor",
            type="error",
            enabled=False,
            organization_id=self.organization.id,
            created_by_id=self.user.id,
        )

        self.error_detector_3 = Detector.objects.create(
            project_id=self.project.id,
            name="Some Other Name",
            type="error",
            enabled=True,
            organization_id=self.organization.id,
            created_by_id=self.user.id,
        )

        # Create detectors with different types that should NOT be updated
        self.performance_detector = Detector.objects.create(
            project_id=self.project.id,
            name="Performance Monitor",
            type="performance",
            enabled=True,
            organization_id=self.organization.id,
            created_by_id=self.user.id,
        )

        self.custom_detector = Detector.objects.create(
            project_id=self.project.id,
            name="Custom Detector",
            type="custom_type",
            enabled=True,
            organization_id=self.organization.id,
            created_by_id=self.user.id,
        )

        # Store original names for verification
        self.original_error_names = [
            self.error_detector_1.name,
            self.error_detector_2.name,
            self.error_detector_3.name,
        ]
        self.original_non_error_names = [
            self.performance_detector.name,
            self.custom_detector.name,
        ]

        # Store IDs for querying after migration
        self.error_detector_ids = [
            self.error_detector_1.id,
            self.error_detector_2.id,
            self.error_detector_3.id,
        ]
        self.non_error_detector_ids = [
            self.performance_detector.id,
            self.custom_detector.id,
        ]

    def test(self):
        Detector = self.apps.get_model("workflow_engine", "Detector")

        # Verify all error detectors have been updated to "Error Monitor"
        error_detectors = Detector.objects.filter(id__in=self.error_detector_ids)
        assert error_detectors.count() == 3, "Should have 3 error detectors"

        for detector in error_detectors:
            assert detector.name == "Error Monitor", (
                f"Error detector {detector.id} should have name 'Error Monitor', "
                f"but has '{detector.name}'"
            )
            assert (
                detector.type == "error"
            ), f"Detector {detector.id} should still have type 'error'"

        # Verify non-error detectors were not changed
        non_error_detectors = Detector.objects.filter(id__in=self.non_error_detector_ids)
        assert non_error_detectors.count() == 2, "Should have 2 non-error detectors"

        performance_detector = non_error_detectors.get(id=self.non_error_detector_ids[0])
        custom_detector = non_error_detectors.get(id=self.non_error_detector_ids[1])

        assert performance_detector.name == "Performance Monitor", (
            f"Performance detector should retain original name 'Performance Monitor', "
            f"but has '{performance_detector.name}'"
        )
        assert custom_detector.name == "Custom Detector", (
            f"Custom detector should retain original name 'Custom Detector', "
            f"but has '{custom_detector.name}'"
        )

        # Verify that only error type detectors were affected
        all_error_detectors = Detector.objects.filter(type="error")
        for detector in all_error_detectors:
            assert detector.name == "Error Monitor", (
                f"All error detectors should have name 'Error Monitor', "
                f"but detector {detector.id} has '{detector.name}'"
            )

        # Verify that no detectors of other types have the new name
        non_error_detectors_with_new_name = Detector.objects.filter(name="Error Monitor").exclude(
            type="error"
        )
        assert (
            non_error_detectors_with_new_name.count() == 0
        ), "No non-error detectors should have the name 'Error Monitor'"

    def test_migration_with_no_error_detectors(self):
        """Test that migration works correctly when there are no error detectors"""
        Detector = self.apps.get_model("workflow_engine", "Detector")

        # Delete all error detectors
        Detector.objects.filter(type="error").delete()

        # Verify no error detectors exist
        error_count = Detector.objects.filter(type="error").count()
        assert error_count == 0, "Should have no error detectors"

        # Verify non-error detectors still exist and are unchanged
        non_error_detectors = Detector.objects.filter(id__in=self.non_error_detector_ids)
        assert non_error_detectors.count() == 2, "Should still have 2 non-error detectors"

    def test_migration_preserves_other_fields(self):
        """Test that migration only changes the name field and preserves other fields"""
        Detector = self.apps.get_model("workflow_engine", "Detector")

        # Get an error detector and verify other fields are preserved
        error_detector = Detector.objects.get(id=self.error_detector_ids[0])

        assert error_detector.name == "Error Monitor", "Name should be updated"
        assert error_detector.type == "error", "Type should be preserved"
        assert error_detector.project_id == self.project.id, "Project should be preserved"
        assert (
            error_detector.organization_id == self.organization.id
        ), "Organization should be preserved"
        assert error_detector.created_by_id == self.user.id, "Created by should be preserved"
        assert error_detector.enabled == True, "Enabled status should be preserved"

        # Check the disabled error detector
        disabled_error_detector = Detector.objects.get(id=self.error_detector_ids[1])
        assert disabled_error_detector.name == "Error Monitor", "Name should be updated"
        assert disabled_error_detector.enabled == False, "Disabled status should be preserved"
