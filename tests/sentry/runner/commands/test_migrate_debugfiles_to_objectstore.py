from __future__ import annotations

from unittest.mock import patch

from django.core.files.base import ContentFile

from sentry.debug_files.objectstore_migration.durable import ShardRunResult
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.files.file import File
from sentry.runner.commands.migrate_debugfiles_to_objectstore import (
    migrate_debugfiles_to_objectstore,
)
from sentry.testutils.cases import CliTestCase
from sentry.testutils.skips import requires_objectstore


class MigrateDebugfilesToObjectstoreCliTest(CliTestCase):
    command = migrate_debugfiles_to_objectstore

    def _create_legacy_dif(self, contents: bytes = b"debug-file-contents") -> ProjectDebugFile:
        file = self.create_file(
            name="test.dSYM",
            type="project.dif",
            headers={"Content-Type": "application/x-mach-binary"},
        )
        file.putfile(ContentFile(contents))
        return self.create_dif_file(project=self.project, file=file)

    @requires_objectstore
    def test_migrates_legacy_debug_files_end_to_end(self) -> None:
        first = self._create_legacy_dif(b"first")
        second = self._create_legacy_dif(b"second")
        first_file_id = first.file_id
        second_file_id = second.file_id

        with self.captureOnCommitCallbacks(execute=True):
            rv = self.invoke()

        assert rv.exit_code == 0
        assert "Migrated 2 debug file(s)." in rv.output

        first.refresh_from_db()
        second.refresh_from_db()
        assert first.file_id is None
        assert second.file_id is None
        assert first.storage_path is not None
        assert second.storage_path is not None
        assert not File.objects.filter(id=first_file_id).exists()
        assert not File.objects.filter(id=second_file_id).exists()

    def test_runs_indexed_durable_shard_from_completion_index_environment(self) -> None:
        with patch(
            "sentry.debug_files.objectstore_migration.run_migration_shard",
            return_value=ShardRunResult.RUNTIME_EXHAUSTED,
        ) as run_shard:
            rv = self.invoke(
                "--shard-count=64",
                "--max-runtime-seconds=21600",
                env={"JOB_COMPLETION_INDEX": "7"},
            )

        assert rv.exit_code == 0
        run_shard.assert_called_once_with(
            shard_id=7,
            shard_count=64,
            max_runtime_seconds=21_600,
        )
        assert "Durable migration shard 7 finished: runtime_exhausted" in rv.output

    def test_rejects_partial_indexed_options(self) -> None:
        rv = self.invoke("--shard-count=64")

        assert rv.exit_code == 2
        assert "must be used together" in rv.output
