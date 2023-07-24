from pathlib import Path

import pytest
from click.testing import CliRunner

from sentry.runner.commands.backup import (
    DEFAULT_COMPARATORS,
    ComparatorMap,
    InstanceID,
    import_,
    validate,
)
from sentry.silo import unguarded_write
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json
from sentry.utils.pytest.fixtures import django_db_all
from tests.sentry.backup import ValidationError, tmp_export_to_file

EMPTY_COMPARATORS_FOR_TESTING: ComparatorMap = {}


def import_export_then_validate(
    tmp_path: Path,
    fixture_file_name: str,
    map: ComparatorMap = EMPTY_COMPARATORS_FOR_TESTING,
) -> None:
    """Test helper that validates that data imported from a fixture `.json` file correctly matches
    the actual outputted export data."""

    fixture_file_path = get_fixture_path("backup", fixture_file_name)
    with open(fixture_file_path) as backup_file:
        expect = json.load(backup_file)

    # TODO(Hybrid-Cloud): Review whether this is the correct route to apply in this case.
    with unguarded_write(using="default"):
        rv = CliRunner().invoke(import_, [str(fixture_file_path)])
        assert rv.exit_code == 0, rv.output

    res = validate(expect, tmp_export_to_file(tmp_path.joinpath("tmp_test_file.json")), map)
    if res.findings:
        raise ValidationError(res)


@django_db_all(transaction=True, reset_sequences=True)
def test_good_fresh_install_validation(tmp_path):
    import_export_then_validate(tmp_path, "fresh-install.json", DEFAULT_COMPARATORS)


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_fresh_install_validation(tmp_path):

    with pytest.raises(ValidationError) as excinfo:
        import_export_then_validate(tmp_path, "fresh-install.json")
    info = excinfo.value.info
    assert len(info.findings) == 2
    assert info.findings[0].kind == "UnequalJSON"
    assert info.findings[0].on == InstanceID("sentry.userrole", 1)
    assert info.findings[1].kind == "UnequalJSON"
    assert info.findings[1].on == InstanceID("sentry.userroleuser", 1)


@django_db_all(transaction=True, reset_sequences=True)
def test_datetime_formatting(tmp_path):
    import_export_then_validate(tmp_path, "datetime-formatting.json")
