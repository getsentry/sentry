import pytest

from sentry.models.organization import Organization
from sentry.preprod.models import PreprodArtifactMobileAppInfo
from sentry.testutils.cases import TestMigrations


@pytest.mark.migrations
class BackfillPreprodArtifactMobileAppInfoTest(TestMigrations):
    migrate_from = "0020_add_preprod_artifact_mobile_app_info"
    migrate_to = "0021_backfill_preprod_artifact_mobile_app_info"
    app = "preprod"

    def setup_before_migration(self, apps):
        PreprodArtifact = apps.get_model("preprod", "PreprodArtifact")

        self.organization: Organization = self.create_organization(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)
        self.user = self.create_user()

        # Create artifact with all mobile app fields
        # state=3 is PROCESSED
        self.artifact_all_fields = PreprodArtifact.objects.create(
            project_id=self.project.id,
            build_version="1.2.3",
            build_number=100,
            app_name="Test App",
            app_icon_id="icon123",
            state=3,
        )

        # Create artifact with some mobile app fields
        # state=3 is PROCESSED
        self.artifact_partial_fields = PreprodArtifact.objects.create(
            project_id=self.project.id,
            build_version="2.0.0",
            build_number=200,
            state=3,
        )

        # Create artifact with no mobile app fields
        # state=0 is UPLOADING
        self.artifact_no_fields = PreprodArtifact.objects.create(
            project_id=self.project.id,
            state=0,
        )

    def test_backfills_mobile_app_info(self):
        # Check artifact with all fields
        mobile_app_info_all = PreprodArtifactMobileAppInfo.objects.get(
            preprod_artifact_id=self.artifact_all_fields.id
        )
        assert mobile_app_info_all.build_version == "1.2.3"
        assert mobile_app_info_all.build_number == 100
        assert mobile_app_info_all.app_name == "Test App"
        assert mobile_app_info_all.app_icon_id == "icon123"

        # Check artifact with partial fields
        mobile_app_info_partial = PreprodArtifactMobileAppInfo.objects.get(
            preprod_artifact_id=self.artifact_partial_fields.id
        )
        assert mobile_app_info_partial.build_version == "2.0.0"
        assert mobile_app_info_partial.build_number == 200
        assert mobile_app_info_partial.app_name is None
        assert mobile_app_info_partial.app_icon_id is None

        # Check artifact with no fields - should not have mobile app info created
        assert not PreprodArtifactMobileAppInfo.objects.filter(
            preprod_artifact_id=self.artifact_no_fields.id
        ).exists()
