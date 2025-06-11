from django.db import router

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.preprod.models import PreprodArtifact
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class AddPreprodModelsTests(TestMigrations):
    app = "preprod"
    migrate_from = "0001_emerge_upload_models"
    migrate_to = "0002_drop_sentry_jsonfield"

    def setup_before_migration(self, apps):
        """Set up test data using OLD models that have the extras field"""
        with unguarded_write(using=router.db_for_write(Organization)):
            # Use different variable names to avoid shadowing imported classes
            OldPreprodArtifact = apps.get_model("preprod", "PreprodArtifact")
            OldOrganization = apps.get_model("sentry", "Organization")
            OldProject = apps.get_model("sentry", "Project")

            org = OldOrganization.objects.create(name="Test Org", slug="test-org")
            project = OldProject.objects.create(
                name="Test Project", slug="test-project", organization=org
            )

            self.project_id = project.id
            self.artifact_with_extras_id = OldPreprodArtifact.objects.create(
                project=project, extras={"old_data": "will_be_dropped"}
            ).id
            self.artifact_no_extras_id = OldPreprodArtifact.objects.create(project=project).id

    def test(self):
        """Test that the migration drops the extras field successfully"""
        with unguarded_write(using=router.db_for_write(Organization)):
            project = Project.objects.get(id=self.project_id)
            artifact_with_extras = PreprodArtifact.objects.get(id=self.artifact_with_extras_id)
            artifact_no_extras = PreprodArtifact.objects.get(id=self.artifact_no_extras_id)

            assert not hasattr(artifact_with_extras, "extras")
            assert not hasattr(artifact_no_extras, "extras")

            new_artifact = PreprodArtifact.objects.create(project=project)
            assert new_artifact.project == project
            assert not hasattr(new_artifact, "extras")
