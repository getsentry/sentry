from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import TestMigrations


class AddPreprodModelsTests(TestMigrations):
    app = "preprod"
    migrate_from = "0001_emerge_upload_models"
    migrate_to = "0002_use_django_jsonfield"

    def test(self):
        """Test that the migration adds the new misc field"""

        org = Organization.objects.create(name="Test Org", slug="test-org")
        project = Project.objects.create(name="Test Project", slug="test-project", organization=org)
        new_artifact = PreprodArtifact.objects.create(project=project, misc={"new_field": "works"})

        assert new_artifact.misc["new_field"] == "works"
