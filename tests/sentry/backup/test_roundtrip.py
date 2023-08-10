import pytest

from sentry.backup.comparators import DEFAULT_COMPARATORS
from sentry.backup.findings import ComparatorFindingKind, InstanceID
from sentry.testutils.helpers.backups import (
    ValidationError,
    import_export_from_fixture_then_validate,
)
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all(transaction=True, reset_sequences=True)
def test_good_fresh_install(tmp_path):
    import_export_from_fixture_then_validate(tmp_path, "fresh-install.json", DEFAULT_COMPARATORS)


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_unequal_json(tmp_path):
    # Without the `DEFAULT_COMPARATORS`, the `date_updated` fields will not be compared using the
    # special comparator logic, and will try to use (and fail on) simple JSON string comparison
    # instead.
    with pytest.raises(ValidationError) as execinfo:
        import_export_from_fixture_then_validate(tmp_path, "fresh-install.json")
    findings = execinfo.value.info.findings

    assert len(findings) == 2
    assert findings[0].kind == ComparatorFindingKind.UnequalJSON
    assert findings[0].on == InstanceID("sentry.userrole", 1)
    assert findings[0].left_pk == 1
    assert findings[0].right_pk == 1
    assert findings[1].kind == ComparatorFindingKind.UnequalJSON
    assert findings[1].on == InstanceID("sentry.userroleuser", 1)
    assert findings[1].left_pk == 1
    assert findings[1].right_pk == 1


@django_db_all(transaction=True, reset_sequences=True)
def test_date_updated_with_zeroed_milliseconds(tmp_path):
    import_export_from_fixture_then_validate(tmp_path, "datetime-with-zeroed-millis.json")


@django_db_all(transaction=True, reset_sequences=True)
def test_date_updated_with_unzeroed_milliseconds(tmp_path):
    with pytest.raises(ValidationError) as execinfo:
        import_export_from_fixture_then_validate(tmp_path, "datetime-with-unzeroed-millis.json")
    findings = execinfo.value.info.findings
    assert len(findings) == 1
    assert findings[0].kind == ComparatorFindingKind.UnequalJSON
    assert findings[0].on == InstanceID("sentry.option", 1)
    assert findings[0].left_pk == 1
    assert findings[0].right_pk == 1
    assert """-  "last_updated": "2023-06-22T00:00:00Z",""" in findings[0].reason
    assert """+  "last_updated": "2023-06-22T00:00:00.000Z",""" in findings[0].reason
