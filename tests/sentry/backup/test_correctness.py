from copy import deepcopy

import pytest

from sentry.backup.comparators import DEFAULT_COMPARATORS
from sentry.backup.findings import InstanceID
from sentry.backup.validate import validate
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import (
    ValidationError,
    import_export_from_fixture_then_validate,
)
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


@django_db_all(transaction=True, reset_sequences=True)
def test_good_fresh_install(tmp_path):
    import_export_from_fixture_then_validate(tmp_path, "fresh-install.json", DEFAULT_COMPARATORS)


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_unequal_json(tmp_path):
    # Without the `DEFAULT_COMPARATORS`, the `date_updated` fields will not be compared correctly.
    with pytest.raises(ValidationError) as excinfo:
        import_export_from_fixture_then_validate(tmp_path, "fresh-install.json")
    findings = excinfo.value.info.findings

    assert len(findings) == 2
    assert findings[0].kind == "UnequalJSON"
    assert findings[0].on == InstanceID("sentry.userrole", 1)
    assert findings[1].kind == "UnequalJSON"
    assert findings[1].on == InstanceID("sentry.userroleuser", 1)


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_duplicate_entry(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        test_json = json.load(backup_file)
    dupe = json.loads(
        """
            {
                "model": "sentry.option",
                "pk": 1,
                "fields": {
                "key": "sentry:latest_version",
                "last_updated": "2023-06-23T00:00:00.000Z",
                "last_updated_by": "unknown",
                "value": "\\"23.7.1\\""
                }
            }
        """
    )
    test_json.append(dupe)
    out = validate(test_json, test_json)
    findings = out.findings

    assert len(findings) == 2
    assert findings[0].kind == "DuplicateEntry"
    assert findings[0].on == InstanceID("sentry.option", 1)
    assert "expected" in findings[0].reason
    assert findings[1].kind == "DuplicateEntry"
    assert findings[1].on == InstanceID("sentry.option", 1)
    assert "actual" in findings[1].reason


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_unexpected_entry(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    unexpected = json.loads(
        """
            {
                "model": "sentry.option",
                "pk": 2,
                "fields": {
                "key": "sentry:last_worker_version",
                "last_updated": "2023-06-23T00:00:00.000Z",
                "last_updated_by": "unknown",
                "value": "\\"23.7.1\\""
                }
            }
        """
    )
    right.append(unexpected)
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1
    assert findings[0].kind == "UnexpectedEntry"
    assert findings[0].on == InstanceID("sentry.option", 2)


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_missing_entry(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    missing = json.loads(
        """
            {
                "model": "sentry.option",
                "pk": 2,
                "fields": {
                "key": "sentry:last_worker_version",
                "last_updated": "2023-06-23T00:00:00.000Z",
                "last_updated_by": "unknown",
                "value": "\\"23.7.1\\""
                }
            }
        """
    )
    left.append(missing)
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1
    assert findings[0].kind == "MissingEntry"
    assert findings[0].on == InstanceID("sentry.option", 2)


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_failing_comparator_field(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    newer = json.loads(
        """
            {
                "model": "sentry.userrole",
                "pk": 1,
                "fields": {
                    "date_updated": "2023-06-22T23:00:00.123Z",
                    "date_added": "2023-06-22T23:00:00.000Z",
                    "name": "Admin",
                    "permissions": "['users.admin']"
                }
            }
        """
    )
    older = json.loads(
        """
            {
                "model": "sentry.userrole",
                "pk": 1,
                "fields": {
                    "date_updated": "2023-06-22T23:00:00.456Z",
                    "date_added": "2023-06-22T23:00:00.000Z",
                    "name": "Admin",
                    "permissions": "['users.admin']"
                }
            }
        """
    )

    # Note that the "newer" version is being added to the left side, meaning that the
    # DateUpdatedComparator will fail.
    left.append(older)
    right.append(newer)
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1
    assert findings[0].kind == "DateUpdatedComparator"


@django_db_all(transaction=True, reset_sequences=True)
def test_good_both_sides_comparator_field_missing(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        test_json = json.load(backup_file)
    userrole_without_date_updated = json.loads(
        """
            {
                "model": "sentry.userrole",
                "pk": 1,
                "fields": {
                    "date_added": "2023-06-22T23:00:00.000Z",
                    "name": "Admin",
                    "permissions": "['users.admin']"
                }
            }
        """
    )
    test_json.append(userrole_without_date_updated)
    out = validate(test_json, test_json)

    assert out.empty()


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_left_side_comparator_field_missing(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    userrole_without_date_updated = json.loads(
        """
            {
                "model": "sentry.userrole",
                "pk": 1,
                "fields": {
                    "date_added": "2023-06-22T23:00:00.000Z",
                    "name": "Admin",
                    "permissions": "['users.admin']"
                }
            }
        """
    )
    userrole_with_date_updated = json.loads(
        """
            {
                "model": "sentry.userrole",
                "pk": 1,
                "fields": {
                    "date_updated": "2023-06-22T23:00:00.123Z",
                    "date_added": "2023-06-22T23:00:00.000Z",
                    "name": "Admin",
                    "permissions": "['users.admin']"
                }
            }
        """
    )
    left.append(userrole_without_date_updated)
    right.append(userrole_with_date_updated)
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1
    assert findings[0].kind == "UnexecutedDateUpdatedComparator"
    assert findings[0].on == InstanceID("sentry.userrole", 1)
    assert "left `date_updated`" in findings[0].reason


@django_db_all(transaction=True, reset_sequences=True)
def test_bad_right_side_comparator_field_missing(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    userrole_without_date_updated = json.loads(
        """
            {
                "model": "sentry.userrole",
                "pk": 1,
                "fields": {
                    "date_added": "2023-06-22T23:00:00.000Z",
                    "name": "Admin",
                    "permissions": "['users.admin']"
                }
            }
        """
    )
    userrole_with_date_updated = json.loads(
        """
            {
                "model": "sentry.userrole",
                "pk": 1,
                "fields": {
                    "date_updated": "2023-06-22T23:00:00.123Z",
                    "date_added": "2023-06-22T23:00:00.000Z",
                    "name": "Admin",
                    "permissions": "['users.admin']"
                }
            }
        """
    )
    left.append(userrole_with_date_updated)
    right.append(userrole_without_date_updated)
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1
    assert findings[0].kind == "UnexecutedDateUpdatedComparator"
    assert findings[0].on == InstanceID("sentry.userrole", 1)
    assert "right `date_updated`" in findings[0].reason


@django_db_all(transaction=True, reset_sequences=True)
def test_date_updated_with_zeroed_milliseconds(tmp_path):
    import_export_from_fixture_then_validate(tmp_path, "datetime-with-zeroed-millis.json")


@django_db_all(transaction=True, reset_sequences=True)
def test_date_updated_with_unzeroed_milliseconds(tmp_path):
    with pytest.raises(ValidationError) as excinfo:
        import_export_from_fixture_then_validate(tmp_path, "datetime-with-unzeroed-millis.json")
    info = excinfo.value.info
    assert len(info.findings) == 1
    assert info.findings[0].kind == "UnequalJSON"
    assert info.findings[0].on == InstanceID("sentry.option", 1)
    assert """-  "last_updated": "2023-06-22T00:00:00Z",""" in info.findings[0].reason
    assert """+  "last_updated": "2023-06-22T00:00:00.000Z",""" in info.findings[0].reason


@django_db_all(transaction=True, reset_sequences=True)
def test_auto_assign_email_obfuscating_comparator(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    useremail_left = json.loads(
        """
            {
                "model": "sentry.useremail",
                "pk": 1,
                "fields": {
                    "user": [
                        "testing@example.com"
                    ],
                    "email": "testing@example.com",
                    "validation_hash": "XXXXXXXX",
                    "date_hash_added": "2023-06-22T00:00:00.000Z",
                    "is_verified": false
                }
            }
        """
    )
    useremail_right = json.loads(
        """
            {
                "model": "sentry.useremail",
                "pk": 1,
                "fields": {
                    "user": [
                        "foo@example.fake"
                    ],
                    "email": "foo@example.fake",
                    "validation_hash": "XXXXXXXX",
                    "date_hash_added": "2023-06-22T00:00:00.000Z",
                    "is_verified": false
                }
            }
        """
    )
    left.append(useremail_left)
    right.append(useremail_right)
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 2

    assert findings[0].kind == "EmailObfuscatingComparator"
    assert findings[0].on == InstanceID("sentry.useremail", 1)
    assert """`email`""" in findings[0].reason
    assert """left value ("t...@...le.com")""" in findings[0].reason
    assert """right value ("f...@...e.fake")""" in findings[0].reason

    assert findings[1].kind == "EmailObfuscatingComparator"
    assert findings[1].on == InstanceID("sentry.useremail", 1)
    assert """`user`""" in findings[1].reason
    assert """left value ("t...@...le.com")""" in findings[1].reason
    assert """right value ("f...@...e.fake")""" in findings[1].reason


@django_db_all(transaction=True, reset_sequences=True)
def test_auto_assign_date_added_comparator(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)

    # Note that `date_added` has different kinds of milliseconds, while `date_updated` has correctly
    # ordered dates.
    userrole_left = json.loads(
        """
            {
                "model": "sentry.userrole",
                "pk": 1,
                "fields": {
                    "date_added": "2023-06-22T23:00:00Z",
                    "date_updated": "2023-06-22T23:00:00.123Z",
                    "name": "Admin",
                    "permissions": "['users.admin']"
                }
            }
        """
    )
    userrole_right = json.loads(
        """
            {
                "model": "sentry.userrole",
                "pk": 1,
                "fields": {
                    "date_added": "2023-06-22T23:00:00.000Z",
                    "date_updated": "2023-06-22T23:00:00.456Z",
                    "name": "Admin",
                    "permissions": "['users.admin']"
                }
            }
        """
    )
    left.append(userrole_left)
    right.append(userrole_right)
    out = validate(left, right)
    findings = out.findings
    assert not findings
