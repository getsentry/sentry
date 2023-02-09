import os

from sentry.runner.commands.backup import export, import_
from sentry.testutils import CliTestCase


class BackupTest(CliTestCase):
    command = export
    tmp_backup_filename = "test_backup.json"

    def test_export(self):
        rv = self.invoke(self.tmp_backup_filename)
        assert rv.exit_code == 0, rv.output
        assert os.path.exists(self.tmp_backup_filename)


class RestoreTest(CliTestCase):
    command = import_
    tmp_backup_filename = "test_backup.json"

    def test_import(self):
        rv = self.invoke(self.tmp_backup_filename)
        assert rv.exit_code == 0, rv.output

    if os.path.exists(tmp_backup_filename):
        os.remove(tmp_backup_filename)
