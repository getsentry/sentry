from __future__ import annotations

from datetime import UTC, datetime
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.base import ContentFile

from sentry.debug_files.objectstore_migration import migrate_debug_file
from sentry.debug_files.objectstore_migration.utils import (
    ObjectstoreIntegrityError,
    PostMigrationMetadata,
    commit,
)
from sentry.models.files.file import File
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_objectstore


class DebugFileObjectstoreMigrationUtilsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        file = self.create_file(
            name="test.dSYM",
            type="project.dif",
            headers={"Content-Type": "application/x-mach-binary"},
        )
        file.putfile(ContentFile(b"debug-file-contents"))
        self.debug_file = self.create_dif_file(project=self.project, file=file)

    @requires_objectstore
    def test_migrates_file_and_deletes_legacy_file(self) -> None:
        file_id = self.debug_file.file_id

        with self.captureOnCommitCallbacks(execute=True):
            migrate_debug_file(self.debug_file)

        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is None
        assert self.debug_file.storage_path is not None
        assert self.debug_file.file_size == len(b"debug-file-contents")
        assert self.debug_file.content_type == "application/x-mach-binary"
        assert self.debug_file.date_created is not None
        assert self.debug_file.checksum is not None
        assert not File.objects.filter(id=file_id).exists()

    @requires_objectstore
    def test_migrates_file_with_empty_checksum(self) -> None:
        file = self.debug_file.file
        assert file is not None
        expected_checksum = file.checksum
        assert expected_checksum is not None
        file.checksum = ""
        file.save(update_fields=["checksum"])

        with (
            patch("sentry.debug_files.objectstore_migration.utils.logger.warning") as warning,
            self.captureOnCommitCallbacks(execute=True),
        ):
            migrate_debug_file(self.debug_file)

        warning.assert_any_call(
            "debug_files.objectstore_migration.checksum_missing",
            extra={"debug_file_id": self.debug_file.id, "file_id": file.id},
        )
        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is None
        assert self.debug_file.storage_path is not None
        assert self.debug_file.checksum == expected_checksum

    @requires_objectstore
    def test_migrates_file_with_missing_size(self) -> None:
        file = self.debug_file.file
        assert file is not None
        expected_size = file.size
        assert expected_size is not None
        file.size = None
        file.save(update_fields=["size"])

        with (
            patch("sentry.debug_files.objectstore_migration.utils.logger.warning") as warning,
            self.captureOnCommitCallbacks(execute=True),
        ):
            migrate_debug_file(self.debug_file)

        warning.assert_any_call(
            "debug_files.objectstore_migration.size_missing",
            extra={"debug_file_id": self.debug_file.id, "file_id": file.id},
        )
        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is None
        assert self.debug_file.storage_path is not None
        assert self.debug_file.file_size == expected_size

    def test_integrity_failure_does_not_cut_over(self) -> None:
        session = MagicMock()
        session.get.side_effect = lambda *args, **kwargs: MagicMock(
            payload=BytesIO(b"not-the-original-contents")
        )

        with (
            patch(
                "sentry.debug_files.objectstore_migration.utils.get_session",
                return_value=session,
            ),
            patch("sentry.utils.retries.time.sleep"),
            pytest.raises(ObjectstoreIntegrityError),
        ):
            session.put.return_value = "uploaded-key"
            migrate_debug_file(self.debug_file)

        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is not None

    def test_commit_noops_when_row_changed(self) -> None:
        metadata = PostMigrationMetadata(
            storage_path="os-key",
            content_type="application/x-mach-binary",
            file_size=19,
            date_created=datetime(2020, 1, 1, tzinfo=UTC),
            checksum="a" * 40,
        )
        source_file_id = self.debug_file.file_id
        assert source_file_id is not None

        self.debug_file.file = None
        self.debug_file.storage_path = "already-migrated"
        self.debug_file.save(update_fields=["file", "storage_path"])

        commit(self.debug_file.id, metadata, source_file_id=source_file_id)
        self.debug_file.refresh_from_db()
        assert self.debug_file.storage_path == "already-migrated"
        assert self.debug_file.file_id is None

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

    def test_keeps_file_still_referenced_by_another_dif(self) -> None:
        other = self.create_dif_file(project=self.project, file=self.debug_file.file)
        file_id = self.debug_file.file_id

        response = MagicMock()
        response.payload = BytesIO(b"debug-file-contents")
        session = MagicMock()
        session.get.return_value = response

        with (
            patch(
                "sentry.debug_files.objectstore_migration.utils.get_session",
                return_value=session,
            ),
            self.captureOnCommitCallbacks(execute=True),
        ):
            session.put.return_value = "os-key"
            migrate_debug_file(self.debug_file)

        self.debug_file.refresh_from_db()
        other.refresh_from_db()
        assert self.debug_file.file_id is None
        assert other.file_id == file_id
        assert File.objects.filter(id=file_id).exists()
