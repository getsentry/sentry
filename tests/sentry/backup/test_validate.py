from copy import deepcopy

from sentry.backup.comparators import get_default_comparators
from sentry.backup.findings import ComparatorFindingKind, InstanceID
from sentry.backup.validate import validate
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json


def test_good_ignore_differing_pks(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    left.append(
        json.loads(
            """
            {
                "model": "sentry.option",
                "pk": 2,
                "fields": {
                "key": "sentry:latest_version",
                "last_updated": "2023-06-23T00:00:00.000Z",
                "last_updated_by": "unknown",
                "value": "\\"23.7.1\\""
                }
            }
        """
        )
    )
    right.append(
        json.loads(
            """
            {
                "model": "sentry.option",
                "pk": 3,
                "fields": {
                "key": "sentry:latest_version",
                "last_updated": "2023-06-23T00:00:00.000Z",
                "last_updated_by": "unknown",
                "value": "\\"23.7.1\\""
                }
            }
        """
        )
    )

    # Test the explicit ssignment of `get_default_comparators()`
    out = validate(left, right, get_default_comparators())
    findings = out.findings
    assert not findings


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
    out = validate(test_json, test_json, get_default_comparators())
    findings = out.findings

    assert len(findings) == 2
    assert findings[0].kind == ComparatorFindingKind.UnorderedInput
    assert findings[0].on == InstanceID("sentry.option", 2)
    assert findings[0].left_pk == 1
    assert not findings[0].right_pk
    assert findings[1].kind == ComparatorFindingKind.UnorderedInput
    assert findings[1].on == InstanceID("sentry.option", 2)
    assert not findings[1].left_pk
    assert findings[1].right_pk == 1


def test_bad_out_of_order_entry(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        test_json = json.load(backup_file)

    # Note that entries are appended in reverse pk order.
    test_json += [
        json.loads(
            """
            {
                "model": "sentry.option",
                "pk": 3,
                "fields": {
                "key": "sentry:latest_version",
                "last_updated": "2023-06-23T00:00:00.000Z",
                "last_updated_by": "unknown",
                "value": "\\"23.7.1\\""
                }
            }
        """
        ),
        json.loads(
            """
            {
                "model": "sentry.option",
                "pk": 2,
                "fields": {
                "key": "sentry:latest_version",
                "last_updated": "2023-06-23T00:00:00.000Z",
                "last_updated_by": "unknown",
                "value": "\\"23.7.1\\""
                }
            }
        """
        ),
    ]
    out = validate(test_json, test_json)
    findings = out.findings

    assert len(findings) == 2
    assert findings[0].kind == ComparatorFindingKind.UnorderedInput
    assert findings[0].on == InstanceID("sentry.option", 3)
    assert findings[0].left_pk == 2
    assert not findings[0].right_pk
    assert findings[1].kind == ComparatorFindingKind.UnorderedInput
    assert findings[1].on == InstanceID("sentry.option", 3)
    assert not findings[1].left_pk
    assert findings[1].right_pk == 2


def test_bad_extra_left_entry(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    extra = json.loads(
        """
            {
                "model": "sentry.option",
                "pk": 2,
                "fields": {
                "key": "sentry:latest_version",
                "last_updated": "2023-06-23T00:00:00.000Z",
                "last_updated_by": "unknown",
                "value": "\\"23.7.1\\""
                }
            }
        """
    )
    left.append(extra)
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1
    assert findings[0].kind == ComparatorFindingKind.UnequalCounts
    assert findings[0].on == InstanceID("sentry.option")
    assert not findings[0].left_pk
    assert not findings[0].right_pk
    assert "2 left" in findings[0].reason
    assert "1 right" in findings[0].reason


def test_bad_extra_right_entry(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    extra = json.loads(
        """
            {
                "model": "sentry.option",
                "pk": 2,
                "fields": {
                "key": "sentry:latest_version",
                "last_updated": "2023-06-23T00:00:00.000Z",
                "last_updated_by": "unknown",
                "value": "\\"23.7.1\\""
                }
            }
        """
    )
    right.append(extra)
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1
    assert findings[0].kind == ComparatorFindingKind.UnequalCounts
    assert findings[0].on == InstanceID("sentry.option")
    assert not findings[0].left_pk
    assert not findings[0].right_pk
    assert "1 left" in findings[0].reason
    assert "2 right" in findings[0].reason


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
    assert findings[0].kind == ComparatorFindingKind.DateUpdatedComparator


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
    assert findings[0].kind == ComparatorFindingKind.DateUpdatedComparatorExistenceCheck
    assert findings[0].on == InstanceID("sentry.userrole", 1)
    assert findings[0].left_pk == 1
    assert findings[0].right_pk == 1
    assert "left `date_updated`" in findings[0].reason


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
    assert findings[0].kind == ComparatorFindingKind.DateUpdatedComparatorExistenceCheck
    assert findings[0].on == InstanceID("sentry.userrole", 1)
    assert findings[0].left_pk == 1
    assert findings[0].right_pk == 1
    assert "right `date_updated`" in findings[0].reason


def test_auto_assign_email_obfuscating_comparator(tmp_path):
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        left = json.load(backup_file)
    right = deepcopy(left)
    email_left = json.loads(
        """
            {
                "model": "sentry.email",
                "pk": 1,
                "fields": {
                    "email": "testing@example.com",
                    "date_added": "2023-06-22T00:00:00.000Z"
                }
            }
        """
    )
    email_right = json.loads(
        """
            {
                "model": "sentry.email",
                "pk": 1,
                "fields": {
                    "email": "foo@example.fake",
                    "date_added": "2023-06-22T00:00:00.000Z"
                }
            }
        """
    )
    left.append(email_left)
    right.append(email_right)
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1

    assert findings[0].kind == ComparatorFindingKind.EmailObfuscatingComparator
    assert findings[0].on == InstanceID("sentry.email", 1)
    assert findings[0].left_pk == 1
    assert findings[0].right_pk == 1
    assert """`email`""" in findings[0].reason
    assert """left value ("t...@...le.com")""" in findings[0].reason
    assert """right value ("f...@...e.fake")""" in findings[0].reason


def test_auto_assign_date_updated_comparator(tmp_path):
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


def test_auto_assign_foreign_key_comparator(tmp_path):
    left = [
        json.loads(
            """
            {
                "model": "sentry.user",
                "pk": 12,
                "fields": {
                    "password": "abc123",
                    "last_login": null,
                    "username": "testing@example.com",
                    "name": "",
                    "email": "testing@example.com"
                }
            }
        """
        )
    ]
    right = [
        json.loads(
            """
            {
                "model": "sentry.user",
                "pk": 34,
                "fields": {
                    "password": "abc123",
                    "last_login": null,
                    "username": "testing@example.com",
                    "name": "",
                    "email": "testing@example.com"
                }
            }
        """
        )
    ]

    userrole_left = json.loads(
        """
            {
                "model": "sentry.useremail",
                "pk": 56,
                "fields": {
                    "user": 12,
                    "email": "testing@example.com",
                    "validation_hash": "ABC123",
                    "date_hash_added": "2023-06-23T00:00:00.000Z",
                    "is_verified": true
                }
            }
        """
    )
    userrole_right = json.loads(
        """
            {
                "model": "sentry.useremail",
                "pk": 78,
                "fields": {
                    "user": 34,
                    "email": "testing@example.com",
                    "validation_hash": "ABC123",
                    "date_hash_added": "2023-06-23T00:00:00.000Z",
                    "is_verified": true
                }
            }
        """
    )
    left.append(userrole_left)
    right.append(userrole_right)
    out = validate(left, right)
    findings = out.findings
    assert not findings


def test_auto_assign_ignored_comparator(tmp_path):
    left = [
        json.loads(
            """
            {
                "model": "sentry.user",
                "pk": 1,
                "fields": {
                    "password": "abc123",
                    "last_login": null,
                    "username": "testing@example.com",
                    "name": "",
                    "email": "testing@example.com",
                    "is_staff": true,
                    "is_active": true,
                    "is_superuser": true,
                    "is_managed": false,
                    "is_sentry_app": null,
                    "is_password_expired": false
                }
            }
        """
        )
    ]
    right = deepcopy(left)

    userrole_left = json.loads(
        """
            {
                "model": "sentry.useremail",
                "pk": 1,
                "fields": {
                    "user": 1,
                    "email": "testing@example.com",
                    "validation_hash": "ABC123",
                    "date_hash_added": "2023-06-22T22:59:55.521Z",
                    "is_verified": false
                }
            }
        """
    )
    userrole_right = json.loads(
        """
            {
                "model": "sentry.useremail",
                "pk": 1,
                "fields": {
                    "user": 1,
                    "email": "testing@example.com",
                    "validation_hash": "DEF456",
                    "date_hash_added": "2023-06-23T00:00:00.000Z",
                    "is_verified": true
                }
            }
        """
    )
    left.append(userrole_left)
    right.append(userrole_right)
    out = validate(left, right)
    findings = out.findings
    assert not findings
