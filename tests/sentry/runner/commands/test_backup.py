import pytest
from click.testing import CliRunner
from django.db import IntegrityError

from sentry.runner.commands.backup import export, import_
from sentry.utils import json


@pytest.fixture
def backup_json_filename(tmp_path):
    backup_json = str(tmp_path.joinpath("test_backup.json"))
    rv = CliRunner().invoke(export, [backup_json], obj={})
    assert rv.exit_code == 0, rv.output
    return backup_json


@pytest.mark.django_db
def test_import(backup_json_filename):
    rv = CliRunner().invoke(import_, backup_json_filename)
    assert rv.exit_code == 0, rv.output


@pytest.mark.django_db
def test_import_duplicate_key(backup_json_filename):
    # Adding an element with the same key as the last item in the backed up file
    # to force a duplicate key violation exception
    with open(backup_json_filename) as backup_file:
        contents = json.load(backup_file)
        duplicate_key_item = contents[-1]
        duplicate_key_item["pk"] += 1
        contents.append(duplicate_key_item)
    with open(backup_json_filename, "w") as backup_file:
        backup_file.write(json.dumps(contents))
    rv = CliRunner().invoke(import_, backup_json_filename)
    assert (
        rv.output
        == ">> Are you restoring from a backup of the same version of Sentry?\n>> Are you restoring onto a clean database?\n>> If so then this IntegrityError might be our fault, you can open an issue here:\n>> https://github.com/getsentry/sentry/issues/new/choose\n"
    )
    assert isinstance(rv.exception, IntegrityError)
    assert rv.exit_code == 1
