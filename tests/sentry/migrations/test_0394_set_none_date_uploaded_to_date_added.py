from uuid import uuid4

from django.utils import timezone

from sentry.models import ArtifactBundle, File
from sentry.testutils.cases import TestMigrations

DEFAULT_ENVIRONMENT_NAME = "production"


class SetNoneDateUploadedToDateAddedTest(TestMigrations):
    migrate_from = "0393_create_groupforecast_table"
    migrate_to = "0394_set_none_date_uploaded_to_date_added"

    def setup_before_migration(self, apps):
        time_1 = timezone.now()

        self.artifact_bundles = []
        for with_date_uploaded in (False, True):
            for i in range(0, 5):
                file = File.objects.create(name="file", type="application/json")
                artifact_bundle = ArtifactBundle.objects.create(
                    organization_id=self.organization.id,
                    bundle_id=uuid4(),
                    file=file,
                    artifact_count=i,
                    date_added=time_1,
                    date_uploaded=time_1 if with_date_uploaded else None,
                )
                self.artifact_bundles.append(artifact_bundle)

    def test(self):
        for artifact_bundle in self.artifact_bundles:
            artifact_bundle.refresh_from_db()
            assert artifact_bundle.date_added == artifact_bundle.date_uploaded
