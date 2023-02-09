import os

from click.testing import CliRunner
from django.utils.functional import cached_property

from sentry.runner.commands.backup import export, import_
from sentry.testutils import CliTestCase, TransactionTestCase


class BackupTest(CliTestCase):
    command = export
    tmp_backup_filename = "test_backup.json"

    def test_export(self):
        rv = self.invoke(self.tmp_backup_filename)
        assert rv.exit_code == 0, rv.output
        assert os.path.exists(self.tmp_backup_filename)


class RestoreTest(TransactionTestCase):
    @cached_property
    def runner(self) -> CliRunner:
        return CliRunner()

    command = import_
    tmp_backup_filename = "test_backup.json"

    def test_import(self):
        rv = self.runner.invoke(self.command, self.tmp_backup_filename)
        assert rv.exit_code == 0, rv.output

    if os.path.exists(tmp_backup_filename):
        os.remove(tmp_backup_filename)
