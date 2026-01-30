import uuid

from sentry.testutils.cases import TestMigrations


class DeleteBadAssertionsTest(TestMigrations):
    migrate_from = "0053_add_response_capture_enabled"
    migrate_to = "0054_delete_bad_assertions"
    app = "uptime"

    def setup_initial_state(self) -> None:
        # Create test organization and project
        self.organization = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.organization)

        self.null_assertion = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex, interval_seconds=300, region_slugs=["default"]
        )

        self.empty_obj_assertion = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            interval_seconds=300,
            region_slugs=["default"],
            assertion={},
        )

        self.obj_assertion = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            interval_seconds=300,
            region_slugs=["default"],
            assertion={"some_value": "asdf"},
        )

    def test_migration(self) -> None:
        # Test detector with basic config gets both thresholds
        self.null_assertion.refresh_from_db()
        assert self.null_assertion.assertion is None
        assert self.null_assertion.id is not None

        # Test detector with basic config gets both thresholds
        self.empty_obj_assertion.refresh_from_db()
        assert self.empty_obj_assertion.assertion is None
        assert self.empty_obj_assertion.id is not None

        # Test detector with partial config gets both thresholds and preserves existing
        self.obj_assertion.refresh_from_db()
        assert self.obj_assertion.assertion is None
        assert self.obj_assertion.id is not None
