import pytest

from sentry.backup.comparators import DEFAULT_COMPARATORS
from sentry.backup.findings import InstanceID
from sentry.testutils.helpers.backups import (
    ValidationError,
    import_export_from_fixture_then_validate,
)
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all(transaction=True, reset_sequences=True)
def test_good_fresh_install_validation(tmp_path):
    import_export_from_fixture_then_validate(tmp_path, "fresh-install.json", DEFAULT_COMPARATORS)


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_fresh_install_validation(tmp_path):

    with pytest.raises(ValidationError) as excinfo:
        import_export_from_fixture_then_validate(tmp_path, "fresh-install.json")
    info = excinfo.value.info
    assert len(info.findings) == 2
    assert info.findings[0].kind == "UnequalJSON"
    assert info.findings[0].on == InstanceID("sentry.userrole", 1)
    assert info.findings[1].kind == "UnequalJSON"
    assert info.findings[1].on == InstanceID("sentry.userroleuser", 1)


@django_db_all(transaction=True, reset_sequences=True)
def test_datetime_formatting(tmp_path):
    import_export_from_fixture_then_validate(tmp_path, "datetime-formatting.json")
