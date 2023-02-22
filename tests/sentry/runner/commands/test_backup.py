import os

import pytest
from click.testing import CliRunner

from sentry.runner.commands.backup import export, import_
from sentry.testutils import CliTestCase

tmp_backup_filename = "test_backup.json"


class BackupTest(CliTestCase):
    command = export

    def test_export(self):
        rv = self.invoke(tmp_backup_filename)
        assert rv.exit_code == 0, rv.output
        assert os.path.exists(tmp_backup_filename)


# Avoid using CliTestCase/TestCase since it wraps everything in an atomic function,
# which creates an error with hybrid cloud fixture protect_user_deletion
@pytest.mark.django_db
def test_import():
    rv = CliRunner().invoke(import_, tmp_backup_filename)
    assert rv.exit_code == 0, rv.output


if os.path.exists(tmp_backup_filename):
    os.remove(tmp_backup_filename)
