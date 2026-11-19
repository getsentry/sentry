import importlib
from unittest import mock

from django.db.migrations.state import StateApps

from sentry.models.artifactbundle import SourceFileType
from sentry.testutils.cases import TestMigrations

# A leading digit is legal in a module name but not in the dotted path mock.patch parses,
# so the module has to be imported by hand to patch anything on it.
migration = importlib.import_module(
    "sentry.migrations.1260_backfill_projectartifactbundle_has_debug_ids"
)


class BackfillProjectArtifactBundleHasDebugIdsTest(TestMigrations):
    app = "sentry"
    migrate_from = "1259_add_projectartifactbundle_has_debug_ids"
    migrate_to = "1260_backfill_projectartifactbundle_has_debug_ids"

    def setUp(self) -> None:
        # Spreads the links over several batches.
        with mock.patch.object(migration, "BATCH_SIZE", 2):
            super().setUp()

    def setup_initial_state(self) -> None:
        self.other_project = self.create_project(organization=self.organization)

    def setup_before_migration(self, apps: StateApps) -> None:
        ArtifactBundle = apps.get_model("sentry", "ArtifactBundle")
        DebugIdArtifactBundle = apps.get_model("sentry", "DebugIdArtifactBundle")
        ProjectArtifactBundle = apps.get_model("sentry", "ProjectArtifactBundle")
        File = apps.get_model("sentry", "File")

        def create_links(debug_ids: int) -> list[int]:
            bundle = ArtifactBundle.objects.create(
                organization_id=self.organization.id,
                file=File.objects.create(name="bundle.zip", type="artifact.bundle"),
                artifact_count=debug_ids,
            )
            for _ in range(debug_ids):
                DebugIdArtifactBundle.objects.create(
                    organization_id=self.organization.id,
                    debug_id="eb6e60f1-65ff-4f6f-adff-f1bbeded627b",
                    artifact_bundle=bundle,
                    source_file_type=SourceFileType.MINIFIED_SOURCE.value,
                )
            # Every link of a bundle gets the same flag.
            return [
                ProjectArtifactBundle.objects.create(
                    organization_id=self.organization.id,
                    project_id=project_id,
                    artifact_bundle=bundle,
                ).id
                for project_id in (self.project.id, self.other_project.id)
            ]

        self.with_debug_ids = [*create_links(2), *create_links(1), *create_links(3)]
        self.without_debug_ids = [*create_links(0), *create_links(0)]

    def test_backfill(self) -> None:
        ProjectArtifactBundle = self.apps.get_model("sentry", "ProjectArtifactBundle")
        has_debug_ids = dict(ProjectArtifactBundle.objects.values_list("id", "has_debug_ids"))

        for link_id in self.with_debug_ids:
            with self.subTest(link_id=link_id):
                assert has_debug_ids[link_id] is True
        for link_id in self.without_debug_ids:
            with self.subTest(link_id=link_id):
                assert has_debug_ids[link_id] is False
