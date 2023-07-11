from pathlib import Path

import pytest
from click.testing import CliRunner
from freezegun import freeze_time

from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.runner.commands.backup import ComparatorFindings, export, import_, validate
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json
from sentry.utils.pytest.fixtures import django_db_all


class ValidationError(Exception):
    def __init__(self, info: ComparatorFindings):
        super().__init__(info.pretty())
        self.info = info


def import_export_then_validate(tmp_path: Path, fixture_file_name: str) -> None:
    """Test helper that validates that the originally imported data correctly matches actual
    outputted export data."""

    fixture_file_path = get_fixture_path("backup", fixture_file_name)
    with open(fixture_file_path) as backup_file:
        input = json.load(backup_file)

    with in_test_psql_role_override("postgres"):
        rv = CliRunner().invoke(import_, [str(fixture_file_path)])
        assert rv.exit_code == 0, rv.output

    tmp_json_file_path = str(tmp_path.joinpath("tmp_test_file.json"))
    rv = CliRunner().invoke(
        export, [tmp_json_file_path], obj={"silent": True, "indent": 2, "exclude": None}
    )
    assert rv.exit_code == 0, rv.output

    with open(tmp_json_file_path) as tmp_file:
        output = json.load(tmp_file)

    res = validate(input, output)
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
