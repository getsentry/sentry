from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

import pytest
from django.core.files.base import ContentFile

from sentry.debug_files.objectstore_migration import migrate_debug_file
from sentry.models.debugfile_migration import DebugFileObjectstoreMigrationRunStatus
from sentry.models.files.file import File
from sentry.objectstore import get_debug_files_session
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_objectstore


class DebugFileObjectstoreMigrationTest(TestCase):
    @pytest.fixture(autouse=True)
    def enable_migration(self) -> Generator[None]:
        with override_options({"debug-files.objectstore-migration.killswitch": False}):
            yield

    def setUp(self) -> None:
        super().setUp()
        file = self.create_file(
            name="test.dSYM",
            type="project.dif",
            headers={"Content-Type": "application/x-mach-binary"},
        )
        file.putfile(ContentFile(b"debug-file-contents"))
        self.debug_file = self.create_dif_file(project=self.project, file=file)
        self.migration_run = self.create_debug_file_objectstore_migration_run(
            high_water_mark=self.debug_file.id,
            status=DebugFileObjectstoreMigrationRunStatus.RUNNING,
        )
        self.shard = self.migration_run.shards.get()
        self.shard.task_generation = 1
        self.shard.save(update_fields=["task_generation"])

    def migrate(self):
        return migrate_debug_file(
            run_id=self.migration_run.id,
            shard_id=self.shard.shard_id,
            expected_generation=self.migration_run.generation,
            task_generation=self.shard.task_generation,
            debug_file_id=self.debug_file.id,
        )

    @requires_objectstore
    def test_migrates_file_and_preserves_legacy_file(self) -> None:
        file_id = self.debug_file.file_id

        self.migrate()

        self.debug_file.refresh_from_db()
        self.shard.refresh_from_db()
        assert self.debug_file.file_id is None
        assert self.debug_file.storage_path is not None
        assert self.debug_file.file_size == len(b"debug-file-contents")
        assert self.debug_file.content_type == "application/x-mach-binary"
        assert self.debug_file.date_created is not None
        assert self.debug_file.checksum is not None
        assert self.shard.cursor_id == self.debug_file.id
        assert self.shard.files_migrated == 1
        assert self.shard.bytes_migrated == len(b"debug-file-contents")
        assert File.objects.filter(id=file_id).exists()

    @requires_objectstore
    def test_existing_objectstore_path_is_reused(self) -> None:
        session = get_debug_files_session(self.organization.id, self.project.id)
        with self.debug_file.file.getfile() as source:
            storage_path = session.put(source, content_type="application/x-mach-binary")
        self.debug_file.storage_path = storage_path
        self.debug_file.save(update_fields=["storage_path"])

        with patch.object(session, "put", wraps=session.put) as put:
            self.migrate()

        assert put.call_count == 0
        self.debug_file.refresh_from_db()
        assert self.debug_file.storage_path == storage_path

    @requires_objectstore
    def test_checksum_mismatch_does_not_cut_over(self) -> None:
        session = get_debug_files_session(self.organization.id, self.project.id)
        storage_path = session.put(b"wrong-contents", content_type="application/x-mach-binary")
        self.debug_file.storage_path = storage_path
        self.debug_file.save(update_fields=["storage_path"])

        with pytest.raises(ValueError, match="does not match"):
            self.migrate()

        self.debug_file.refresh_from_db()
        self.shard.refresh_from_db()
        assert self.debug_file.file_id is not None
        assert self.shard.cursor_id == 0

    @requires_objectstore
    def test_stale_generation_does_not_cut_over(self) -> None:
        self.migration_run.generation += 1
        self.migration_run.save(update_fields=["generation"])

        with pytest.raises(RuntimeError, match="Stale migration task"):
            self.migrate()

        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is not None

    def test_retries_transient_failure(self) -> None:
        with (
            patch(
                "sentry.debug_files.objectstore_migration._prepare_object",
                side_effect=[OSError("temporary")] * 4,
            ),
            patch("sentry.utils.retries.time.sleep"),
            pytest.raises(OSError),
        ):
            self.migrate()

        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is not None
