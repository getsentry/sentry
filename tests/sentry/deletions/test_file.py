from typing import int
from datetime import timedelta

from django.utils import timezone

from sentry.deletions.defaults.file import FileDeletionTask
from sentry.models.files.file import File
from sentry.models.files.fileblobindex import FileBlobIndex
from sentry.models.releasefile import ReleaseFile
from sentry.testutils.cases import TestCase


class FileDeletionTaskTest(TestCase):
    def test_get_query_filter_orphaned_release_file(self) -> None:
        """Test that orphaned release.file type Files are selected for deletion"""
        project = self.create_project()
        self.create_release(project=project)

        # Create an orphaned release.file (no ReleaseFile pointing to it)
        old_timestamp = timezone.now() - timedelta(days=91)
        orphaned_file = File.objects.create(
            name="orphaned.js",
            type="release.file",
            timestamp=old_timestamp,
        )

        # Get the deletion task and query filter
        task = FileDeletionTask(
            manager=None,  # type: ignore[arg-type]
            model=File,
            query={},
        )
        query_filter = task.get_query_filter()

        # Apply the filter to get Files that should be deleted
        files_to_delete = File.objects.filter(query_filter)

        assert orphaned_file in files_to_delete

    def test_get_query_filter_does_not_select_referenced_file(self) -> None:
        """Test that Files referenced by ReleaseFile are NOT selected for deletion"""
        project = self.create_project()
        release = self.create_release(project=project)

        # Create a File and ReleaseFile pointing to it
        old_timestamp = timezone.now() - timedelta(days=91)
        referenced_file = File.objects.create(
            name="referenced.js",
            type="release.file",
            timestamp=old_timestamp,
        )
        ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=referenced_file,
            name="referenced.js",
            ident="abc123",
        )

        # Get the deletion task and query filter
        task = FileDeletionTask(
            manager=None,  # type: ignore[arg-type]
            model=File,
            query={},
        )
        query_filter = task.get_query_filter()

        # Apply the filter
        files_to_delete = File.objects.filter(query_filter)

        assert referenced_file not in files_to_delete

    def test_get_query_filter_does_not_select_recent_files(self) -> None:
        """Test that recent Files are NOT selected even if orphaned"""
        # Create an orphaned file but with recent timestamp
        recent_file = File.objects.create(
            name="recent.js",
            type="release.file",
            timestamp=timezone.now() - timedelta(days=30),  # Only 30 days old
        )

        # Get the deletion task and query filter
        task = FileDeletionTask(
            manager=None,  # type: ignore[arg-type]
            model=File,
            query={},
        )
        query_filter = task.get_query_filter()

        # Apply the filter
        files_to_delete = File.objects.filter(query_filter)

        assert recent_file not in files_to_delete

    def test_get_query_filter_artifact_index_files(self) -> None:
        """Test that orphaned release.artifact-index Files are selected"""
        old_timestamp = timezone.now() - timedelta(days=91)
        orphaned_index = File.objects.create(
            name="artifact-index.json",
            type="release.artifact-index",
            timestamp=old_timestamp,
        )

        task = FileDeletionTask(
            manager=None,  # type: ignore[arg-type]
            model=File,
            query={},
        )
        query_filter = task.get_query_filter()
        files_to_delete = File.objects.filter(query_filter)

        assert orphaned_index in files_to_delete

    def test_get_query_filter_does_not_select_other_file_types(self) -> None:
        """Test that non-release file types are NOT selected"""
        old_timestamp = timezone.now() - timedelta(days=91)

        # Create files with different types
        artifact_bundle_file = File.objects.create(
            name="bundle.zip",
            type="artifact.bundle",
            timestamp=old_timestamp,
        )
        debug_file = File.objects.create(
            name="debug.sym",
            type="debug.file",
            timestamp=old_timestamp,
        )

        task = FileDeletionTask(
            manager=None,  # type: ignore[arg-type]
            model=File,
            query={},
        )
        query_filter = task.get_query_filter()
        files_to_delete = File.objects.filter(query_filter)

        assert artifact_bundle_file not in files_to_delete
        assert debug_file not in files_to_delete

    def test_get_child_relations(self) -> None:
        """Test that FileBlobIndex records are returned as child relations"""
        file = File.objects.create(
            name="test.js",
            type="release.file",
        )

        task = FileDeletionTask(
            manager=None,  # type: ignore[arg-type]
            model=File,
            query={},
        )
        child_relations = task.get_child_relations(file)

        # Should have one relation for FileBlobIndex
        assert len(child_relations) == 1
        assert child_relations[0].params["model"] == FileBlobIndex
        assert child_relations[0].params["query"] == {"file_id": file.id}
