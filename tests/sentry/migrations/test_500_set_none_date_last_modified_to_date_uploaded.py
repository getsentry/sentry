import uuid

import pytest
from django.utils import timezone

from sentry.models.artifactbundle import ArtifactBundle
from sentry.models.files.file import File
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip(
    "Test setup no longer valid after adding 'indexing_state' field to 'ArtifactBundle'"
)
class SetNoneDateLastModifiedToDateUploadedTest(TestMigrations):
    migrate_from = "0499_typed_bitfield_revert"
    migrate_to = "0500_set_none_date_last_modified_to_date_uploaded"

    def setup_before_migration(self, apps):
        ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            bundle_id=uuid.uuid4().hex,
            file=File.objects.create(name="bundle.zip", type="application/octet-stream"),
            artifact_count=10,
            date_added=timezone.now(),
            date_uploaded=timezone.now(),
            date_last_modified=None,
        )

    def test_none_date_is_set(self):
        artifact_bundles = ArtifactBundle.objects.all()
        for artifact_bundle in artifact_bundles:
            assert artifact_bundle.date_last_modified is not None
            assert artifact_bundle.date_last_modified == artifact_bundle.date_uploaded
