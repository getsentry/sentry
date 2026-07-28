from __future__ import annotations

from collections.abc import Generator
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.base import ContentFile

from sentry.debug_files.objectstore_migration import migrate_debug_file
from sentry.debug_files.objectstore_migration.utils import MigrationIntegrityError
from sentry.models.files.file import File
from sentry.objectstore import get_debug_files_session
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_objectstore


class DebugFileObjectstoreMigrationUtilsTest(TestCase):
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

    def migrate(self) -> None:
        migrate_debug_file(self.debug_file.id)

    @requires_objectstore
    def test_migrates_file_and_deletes_legacy_file(self) -> None:
        file_id = self.debug_file.file_id

        with self.captureOnCommitCallbacks(execute=True):
            self.migrate()

        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is None
        assert self.debug_file.storage_path is not None
        assert self.debug_file.file_size == len(b"debug-file-contents")
        assert self.debug_file.content_type == "application/x-mach-binary"
        assert self.debug_file.date_created is not None
        assert self.debug_file.checksum is not None
        assert not File.objects.filter(id=file_id).exists()

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

    def test_post_upload_integrity_failure_retries_and_does_not_cut_over(self) -> None:
        # Upload succeeds; re-download payload does not match the File checksum.
        # Fresh payload each get() — retries close the previous stream.
        session = MagicMock()
        session.get.side_effect = lambda *args, **kwargs: MagicMock(
            payload=BytesIO(b"not-the-original-contents")
        )

        with (
            patch(
                "sentry.debug_files.objectstore_migration.utils.get_debug_files_session",
                return_value=session,
            ),
            patch(
                "sentry.debug_files.objectstore_migration.utils._upload_dif_to_objectstore",
                return_value="uploaded-key",
            ),
            patch("sentry.utils.retries.time.sleep"),
            pytest.raises(MigrationIntegrityError),
        ):
            self.migrate()

        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is not None

    def test_missing_project_skips(self) -> None:
        with patch(
            "sentry.models.project.Project.objects.get_from_cache",
            side_effect=self.project.__class__.DoesNotExist,
        ):
            self.migrate()

        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is not None

    def test_commit_skips_when_already_cut_over_or_file_changed(self) -> None:
        from datetime import UTC, datetime

        from sentry.debug_files.objectstore_migration.utils import (
            PostMigrationMetadata,
            commit,
        )

        metadata = PostMigrationMetadata(
            storage_path="os-key",
            content_type="application/x-mach-binary",
            file_size=19,
            date_created=datetime(2020, 1, 1, tzinfo=UTC),
            checksum="a" * 40,
        )
        source_file_id = self.debug_file.file_id
        assert source_file_id is not None

        # Already cut over: clearing file_id makes commit a no-op.
        self.debug_file.file = None
        self.debug_file.storage_path = "already-migrated"
        self.debug_file.save(update_fields=["file", "storage_path"])

        commit(self.debug_file.id, metadata, source_file_id=source_file_id)
        self.debug_file.refresh_from_db()
        assert self.debug_file.storage_path == "already-migrated"
        assert self.debug_file.file_id is None

        # File identity changed under us: different source_file_id → no-op.
        other_file = self.create_file(
            name="other.dSYM",
            type="project.dif",
            headers={"Content-Type": "application/x-mach-binary"},
        )
        other_file.putfile(ContentFile(b"other"))
        self.debug_file.file = other_file
        self.debug_file.storage_path = None
        self.debug_file.save(update_fields=["file", "storage_path"])

        commit(self.debug_file.id, metadata, source_file_id=source_file_id)
        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id == other_file.id
        assert self.debug_file.storage_path is None

    def test_cutover_uses_legacy_content_type_not_objectstore_metadata(self) -> None:
        """Objectstore may omit/normalize MIME; cutover must keep File headers."""
        source = self.debug_file.file
        assert source is not None
        original_timestamp = source.timestamp
        payload = b"debug-file-contents"

        # Dual-write footprint: storage_path set, null content_type column.
        self.debug_file.storage_path = "existing-os-key"
        self.debug_file.content_type = None
        self.debug_file.save(update_fields=["storage_path", "content_type"])

        response = MagicMock()
        response.metadata.content_type = None
        response.payload = BytesIO(payload)

        session = MagicMock()
        session.get.return_value = response

        with (
            patch(
                "sentry.debug_files.objectstore_migration.utils.get_debug_files_session",
                return_value=session,
            ),
            patch(
                "sentry.debug_files.objectstore_migration.utils._upload_dif_to_objectstore",
                return_value="os-key",
            ),
        ):
            self.migrate()

        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is None
        assert self.debug_file.content_type == "application/x-mach-binary"
        assert self.debug_file.file_format == "macho"
        assert self.debug_file.date_created == original_timestamp

    def test_cutover_keeps_file_still_referenced_by_another_dif(self) -> None:
        other = self.create_dif_file(project=self.project, file=self.debug_file.file)
        file_id = self.debug_file.file_id
        payload = b"debug-file-contents"

        response = MagicMock()
        response.metadata.content_type = None
        response.payload = BytesIO(payload)
        session = MagicMock()
        session.get.return_value = response

        with (
            patch(
                "sentry.debug_files.objectstore_migration.utils.get_debug_files_session",
                return_value=session,
            ),
            patch(
                "sentry.debug_files.objectstore_migration.utils._upload_dif_to_objectstore",
                return_value="os-key",
            ),
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.migrate()

        self.debug_file.refresh_from_db()
        other.refresh_from_db()
        assert self.debug_file.file_id is None
        assert other.file_id == file_id
        assert File.objects.filter(id=file_id).exists()
