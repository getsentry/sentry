import atexit
import os

import pytest
from click.testing import CliRunner
from django.db import IntegrityError

from sentry.runner.commands.backup import export, import_
from sentry.testutils import CliTestCase
from sentry.utils import json

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


@pytest.mark.django_db
def test_import_duplicate_key():
    # Adding an element with the same key as the last item in the backed up file
    # to force a duplicate key violation exception
    with open(tmp_backup_filename) as backup_file:
        contents = json.load(backup_file)
        duplicate_key_item = contents[-1]
        duplicate_key_item["pk"] += 1
        contents.append(duplicate_key_item)
    with open(tmp_backup_filename, "w") as backup_file:
        backup_file.write(json.dumps(contents))
    rv = CliRunner().invoke(import_, tmp_backup_filename)
    assert (
        rv.output
        == ">> Are you restoring from a backup of the same version of Sentry?\n>> Are you restoring onto a clean database?\n>> If so then this IntegrityError might be our fault, you can open an issue here:\n>> https://github.com/getsentry/sentry/issues/new/choose\n"
    )
    assert isinstance(rv.exception, IntegrityError)
    assert rv.exit_code == 1


# Cleanup backup file once test suite finishes
# Using atexit here instead of the teardown hook since
# we're avoiding using CliTestCase/TestCase due to failing fixture
@atexit.register
def cleanup_backup_file():
    if os.path.exists(tmp_backup_filename):
        os.remove(tmp_backup_filename)
