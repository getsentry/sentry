from pathlib import Path

import pytest
from click.testing import CliRunner

from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.runner.commands.backup import (
    DEFAULT_COMPARATORS,
    ComparatorMap,
    DateUpdatedComparator,
    InstanceID,
    import_,
    validate,
)
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json
from sentry.utils.pytest.fixtures import django_db_all
from tests.sentry.backup import ValidationError, tmp_export_to_file


def django_db_complete_reset(func=None):
    """Pytest decorator for resetting all databases, including pk sequences"""

    if func is not None:
        return pytest.mark.django_db(transaction=True, reset_sequences=True, databases="__all__")(
            func
        )

    def decorator(function):
        return pytest.mark.django_db(transaction=True, reset_sequences=True, databases="__all__")(
            function
        )

    return decorator


def import_export_then_validate(tmp_path: Path, fixture_file_name: str, map: ComparatorMap) -> None:
    """Test helper that validates that data imported from a fixture `.json` file correctly matches
    the actual outputted export data."""

    fixture_file_path = get_fixture_path("backup", fixture_file_name)
    with open(fixture_file_path) as backup_file:
        expect = json.load(backup_file)

    with in_test_psql_role_override("postgres"):
        rv = CliRunner().invoke(import_, [str(fixture_file_path)])
        assert rv.exit_code == 0, rv.output

    res = validate(
        expect,
        tmp_export_to_file(tmp_path.joinpath("tmp_test_file.json")),
        map,
    )
    if res.findings:
        raise ValidationError(res)


@django_db_all(transaction=True, reset_sequences=True)
def test_good_fresh_install_validation(tmp_path):
    import_export_then_validate(tmp_path, "fresh-install.json", DEFAULT_COMPARATORS)


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_fresh_install_validation(tmp_path):

    with pytest.raises(ValidationError) as excinfo:
        import_export_then_validate(tmp_path, "fresh-install.json", {})
    info = excinfo.value.info
    assert len(info.findings) == 2
    assert info.findings[0].name == "UnequalJSON"
    assert info.findings[0].on == InstanceID("sentry.userrole", 1)
    assert info.findings[1].name == "UnequalJSON"
    assert info.findings[1].on == InstanceID("sentry.userroleuser", 1)


def test_good_date_updated_comparator():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 1)
    left = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    right = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    assert cmp.compare(id, left, right) is None


def test_bad_date_updated_comparator():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 1)
    left = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    right = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.001Z",
        },
    }
    res = cmp.compare(id, left, right)
    assert res is not None
    assert res.on == id
    assert res.name == "DateUpdatedComparator"
