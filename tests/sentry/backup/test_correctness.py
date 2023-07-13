from pathlib import Path

import pytest
from click.testing import CliRunner
from freezegun import freeze_time

from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.runner.commands.backup import import_, validate
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json
from sentry.utils.pytest.fixtures import django_db_all
from tests.sentry.backup import ValidationError, tmp_export_to_file


def import_export_then_validate(tmp_path: Path, fixture_file_name: str) -> None:
    """Test helper that validates that data imported from a fixture `.json` file correctly matches
    the actual outputted export data."""

    fixture_file_path = get_fixture_path("backup", fixture_file_name)
    with open(fixture_file_path) as backup_file:
        expect = json.load(backup_file)

    with in_test_psql_role_override("postgres"):
        rv = CliRunner().invoke(import_, [str(fixture_file_path)])
        assert rv.exit_code == 0, rv.output

    res = validate(expect, tmp_export_to_file(tmp_path.joinpath("tmp_test_file.json")))
    if res.findings:
        raise ValidationError(res)


@django_db_all(transaction=True, reset_sequences=True)
@freeze_time("2023-06-22T23:00:00.123Z")
def test_good_fresh_install_validation(tmp_path):
    import_export_then_validate(tmp_path, "fresh-install.json")


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_fresh_install_validation(tmp_path):
    with pytest.raises(ValidationError) as excinfo:
        import_export_then_validate(tmp_path, "fresh-install.json")
    assert len(excinfo.value.info.findings) == 2


@django_db_all(transaction=True, reset_sequences=True)
def test_datetime_formatting(tmp_path):
    import_export_then_validate(tmp_path, "datetime-formatting.json")
