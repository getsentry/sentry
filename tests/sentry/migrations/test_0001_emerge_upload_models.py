from sentry.testutils.cases import TestMigrations


class AddPreprodModelsTests(TestMigrations):
    app = "preprod"
    migrate_from = "0001_emerge_upload_models"
    migrate_to = "0001_emerge_upload_models"

    def setup_initial_state(self):
        pass

    def test(self):
        from sentry.preprod.models import PreprodArtifact, PreprodBuildConfiguration

        org = self.create_organization()
        project = self.create_project(organization=org)
        PreprodArtifact.objects.create(project=project)
        PreprodBuildConfiguration.objects.create(project=project, name="Release")
