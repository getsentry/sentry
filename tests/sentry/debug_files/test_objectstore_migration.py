from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

import pytest
from django.core.files.base import ContentFile

from sentry.debug_files.objectstore_migration import (
    ObjectstoreIntegrityError,
    freeze_high_water_mark,
    migrate_debug_file,
    start_migration,
)
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

    def migrate(self) -> int:
        return migrate_debug_file(debug_file_id=self.debug_file.id)

    @requires_objectstore
    def test_migrates_file_and_preserves_legacy_file(self) -> None:
        file_id = self.debug_file.file_id

        self.migrate()

        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is None
        assert self.debug_file.storage_path is not None
        assert self.debug_file.file_size == len(b"debug-file-contents")
        assert self.debug_file.content_type == "application/x-mach-binary"
        assert self.debug_file.date_created is not None
        assert self.debug_file.checksum is not None
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

    def test_post_upload_integrity_failure_retries_and_does_not_cut_over(self) -> None:
        # Force post-upload verify to keep failing so the outer retry policy kicks in.
        with (
            patch(
                "sentry.debug_files.objectstore_migration._verify_object",
                side_effect=ObjectstoreIntegrityError("post-upload mismatch"),
            ),
            patch("sentry.utils.retries.time.sleep"),
            patch(
                "sentry.debug_files.objectstore_migration._upload_dif_to_objectstore",
                return_value="uploaded-key",
            ),
            pytest.raises(ObjectstoreIntegrityError),
        ):
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

    def test_missing_project_skips(self) -> None:
        with patch(
            "sentry.models.project.Project.objects.get_from_cache",
            side_effect=self.project.__class__.DoesNotExist,
        ):
            size = self.migrate()

        assert size == 0
        self.debug_file.refresh_from_db()
        assert self.debug_file.file_id is not None

    def test_start_migration_enqueues_shards_with_hwm(self) -> None:
        high_water_mark = freeze_high_water_mark()

        with patch(
            "sentry.debug_files.objectstore_migration_tasks.migrate_shard.apply_async"
        ) as enqueue:
            asserted = start_migration(shard_count=3)

        assert asserted == 3
        assert enqueue.call_count == 3
        kwargs_list = [call.kwargs["kwargs"] for call in enqueue.call_args_list]
        assert {k["shard_id"] for k in kwargs_list} == {0, 1, 2}
        for kwargs in kwargs_list:
            assert kwargs["shard_count"] == 3
            assert kwargs["high_water_mark"] == high_water_mark
            assert kwargs["cursor_id"] == 0

    def test_start_migration_resume_preserves_cursors(self) -> None:
        with patch(
            "sentry.debug_files.objectstore_migration_tasks.migrate_shard.apply_async"
        ) as enqueue:
            asserted = start_migration(
                shard_count=2,
                high_water_mark=99,
                cursors={0: 40, 1: 41},
                shard_ids=[0, 1],
            )

        assert asserted == 2
        kwargs_by_shard = {
            call.kwargs["kwargs"]["shard_id"]: call.kwargs["kwargs"]
            for call in enqueue.call_args_list
        }
        assert kwargs_by_shard[0]["cursor_id"] == 40
        assert kwargs_by_shard[1]["cursor_id"] == 41
        assert kwargs_by_shard[0]["high_water_mark"] == 99
