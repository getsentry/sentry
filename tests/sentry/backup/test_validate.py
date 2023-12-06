from copy import deepcopy

from sentry.backup.comparators import get_default_comparators
from sentry.backup.findings import ComparatorFindingKind, InstanceID
from sentry.backup.validate import validate
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json


def copy_model(model: json.JSONData, new_pk: int) -> json.JSONData:
    new_model = deepcopy(model)
    new_model["pk"] = new_pk
    return new_model


def test_good_ignore_differing_pks():
    with open(get_fixture_path("backup", "single-integration.json")) as backup_file:
        test_integration = json.load(backup_file)[0]
    left = [copy_model(test_integration, 2)]
    right = [copy_model(test_integration, 2)]
    right = deepcopy(left)

    # Test the explicit ssignment of `get_default_comparators()`
    out = validate(left, right, get_default_comparators())
    findings = out.findings
    assert not findings


def test_bad_duplicate_entry():
    with open(get_fixture_path("backup", "single-integration.json")) as backup_file:
        test_integration = json.load(backup_file)[0]
    test_json = [test_integration, deepcopy(test_integration)]
    out = validate(test_json, test_json, get_default_comparators())
    findings = out.findings

    assert len(findings) == 2
    assert findings[0].kind == ComparatorFindingKind.UnorderedInput
    assert findings[0].on == InstanceID("sentry.integration", 2)
    assert findings[0].left_pk == 1
    assert not findings[0].right_pk
    assert findings[1].kind == ComparatorFindingKind.UnorderedInput
    assert findings[1].on == InstanceID("sentry.integration", 2)
    assert not findings[1].left_pk
    assert findings[1].right_pk == 1


def test_bad_out_of_order_entry():
    with open(get_fixture_path("backup", "single-integration.json")) as backup_file:
        test_integration = json.load(backup_file)[0]

    # Note that entries are appended in reverse pk order.
    test_json = [test_integration, copy_model(test_integration, 3), copy_model(test_integration, 2)]
    out = validate(test_json, test_json)
    findings = out.findings

    assert len(findings) == 2
    assert findings[0].kind == ComparatorFindingKind.UnorderedInput
    assert findings[0].on == InstanceID("sentry.integration", 3)
    assert findings[0].left_pk == 2
    assert not findings[0].right_pk
    assert findings[1].kind == ComparatorFindingKind.UnorderedInput
    assert findings[1].on == InstanceID("sentry.integration", 3)
    assert not findings[1].left_pk
    assert findings[1].right_pk == 2


def test_bad_extra_left_entry():
    with open(get_fixture_path("backup", "single-integration.json")) as backup_file:
        test_integration = json.load(backup_file)[0]
    left = [deepcopy(test_integration), copy_model(test_integration, 2)]
    right = [test_integration]
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1
    assert findings[0].kind == ComparatorFindingKind.UnequalCounts
    assert findings[0].on == InstanceID("sentry.integration")
    assert not findings[0].left_pk
    assert not findings[0].right_pk
    assert "2 left" in findings[0].reason
    assert "1 right" in findings[0].reason


def test_bad_extra_right_entry():
    with open(get_fixture_path("backup", "single-integration.json")) as backup_file:
        test_integration = json.load(backup_file)[0]
    left = [test_integration]
    right = [deepcopy(test_integration), copy_model(test_integration, 2)]
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1
    assert findings[0].kind == ComparatorFindingKind.UnequalCounts
    assert findings[0].on == InstanceID("sentry.integration")
    assert not findings[0].left_pk
    assert not findings[0].right_pk
    assert "1 left" in findings[0].reason
    assert "2 right" in findings[0].reason


def test_bad_failing_comparator_field():
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


def test_good_both_sides_comparator_field_missing():
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


def test_bad_left_side_comparator_field_missing():
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


def test_bad_right_side_comparator_field_missing():
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


def test_auto_assign_email_obfuscating_comparator():
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


def test_auto_assign_date_updated_comparator():
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


def test_auto_assign_foreign_key_comparator():
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

    useremail_left = json.loads(
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
    useremail_right = json.loads(
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
    left.append(useremail_left)
    right.append(useremail_right)
    out = validate(left, right)
    findings = out.findings
    assert not findings


def test_auto_assign_ignored_comparator():
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

    useremail_left = json.loads(
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
    useremail_right = json.loads(
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
    left.append(useremail_left)
    right.append(useremail_right)
    out = validate(left, right)
    findings = out.findings
    assert not findings


def test_bad_missing_custom_ordinal():
    left = json.loads(
        """
            [
                {
                    "model": "sentry.email",
                    "pk": 1,
                    "fields": {
                        "email": "a@example.com",
                        "date_added": "2023-06-22T00:00:00.000Z"
                    }
                },
                {
                    "model": "sentry.email",
                    "pk": 2,
                    "fields": {
                        "email": "b@example.com",
                        "date_added": "2023-06-22T00:00:00.000Z"
                    }
                }
            ]
        """
    )
    right = json.loads(
        """
            [
                {
                    "model": "sentry.email",
                    "pk": 1,
                    "fields": {
                        "email": "c@example.com",
                        "date_added": "2023-06-22T00:00:00.000Z"
                    }
                },
                {
                    "model": "sentry.email",
                    "pk": 2,
                    "fields": {
                        "email": "a@example.com",
                        "date_added": "2023-06-22T00:00:00.000Z"
                    }
                }
            ]
        """
    )
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1

    assert findings[0].kind == ComparatorFindingKind.EmailObfuscatingComparator
    assert findings[0].on == InstanceID("sentry.email", 2)
    assert findings[0].left_pk == 2
    assert findings[0].right_pk == 1
    assert "b...@...le.com" in findings[0].reason
    assert "c...@...le.com" in findings[0].reason


def test_bad_unequal_custom_ordinal():
    left = json.loads(
        """
            [
                {
                    "model": "sentry.option",
                    "pk": 1,
                    "fields": {
                        "key": "sentry:latest_version",
                        "last_updated": "2023-06-22T00:00:00.000Z",
                        "last_updated_by": "unknown",
                        "value": "1.2.3"
                    }
                }
            ]
        """
    )
    right = json.loads(
        """
            [
                {
                    "model": "sentry.option",
                    "pk": 1,
                    "fields": {
                        "key": "sentry:latest_version",
                        "last_updated": "2023-06-22T00:00:00.000Z",
                        "last_updated_by": "unknown",
                        "value": "4.5.6"
                    }
                }
            ]
        """
    )
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 1

    assert findings[0].kind == ComparatorFindingKind.UnequalJSON


def test_bad_duplicate_custom_ordinal():
    with open(get_fixture_path("backup", "single-option.json")) as backup_file:
        test_option = json.load(backup_file)[0]
    test_json = [test_option, copy_model(test_option, 2)]
    out = validate(test_json, test_json, get_default_comparators())
    findings = out.findings

    assert len(findings) == 2
    assert findings[0].kind == ComparatorFindingKind.DuplicateCustomOrdinal
    assert findings[0].on == InstanceID("sentry.option", None)
    assert findings[0].left_pk == 2
    assert not findings[0].right_pk
    assert findings[1].kind == ComparatorFindingKind.DuplicateCustomOrdinal
    assert findings[1].on == InstanceID("sentry.option", None)
    assert not findings[1].left_pk
    assert findings[1].right_pk == 2


def test_good_option_custom_ordinal():
    left = json.loads(
        """
            [
                {
                    "model": "sentry.option",
                    "pk": 1,
                    "fields": {
                        "key": "sentry:foo",
                        "last_updated": "2023-06-22T00:00:00.000Z",
                        "last_updated_by": "unknown",
                        "value": "1.2.3"
                    }
                },
                {
                    "model": "sentry.option",
                    "pk": 2,
                    "fields": {
                        "key": "sentry:bar",
                        "last_updated": "2023-06-22T00:00:00.000Z",
                        "last_updated_by": "unknown",
                        "value": "sample"
                    }
                }
            ]
        """
    )

    # Note that all models are in reverse order for their kind.
    right = json.loads(
        """
            [

                {
                    "model": "sentry.option",
                    "pk": 1,
                    "fields": {
                        "key": "sentry:bar",
                        "last_updated": "2023-06-22T00:00:00.000Z",
                        "last_updated_by": "unknown",
                        "value": "sample"
                    }
                },
                {
                    "model": "sentry.option",
                    "pk": 2,
                    "fields": {
                        "key": "sentry:foo",
                        "last_updated": "2023-06-22T00:00:00.000Z",
                        "last_updated_by": "unknown",
                        "value": "1.2.3"
                    }
                }
            ]
        """
    )
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 0


def test_good_user_custom_ordinal():
    left = json.loads(
        """
            [
                {
                    "model": "sentry.user",
                    "pk": 12,
                    "fields": {
                        "password": "abc123",
                        "last_login": null,
                        "username": "someuser",
                        "name": "",
                        "email": "a@example.com"
                    }
                },
                {
                    "model": "sentry.user",
                    "pk": 34,
                    "fields": {
                        "password": "abc123",
                        "last_login": null,
                        "username": "otheruser",
                        "name": "",
                        "email": "b@example.com"
                    }
                },
                {
                    "model": "sentry.email",
                    "pk": 1,
                    "fields": {
                        "email": "a@example.com",
                        "date_added": "2023-06-22T00:00:00.000Z"
                    }
                },
                {
                    "model": "sentry.email",
                    "pk": 2,
                    "fields": {
                        "email": "b@example.com",
                        "date_added": "2023-06-22T00:00:00.000Z"
                    }
                },
                {
                "model": "sentry.useremail",
                    "pk": 56,
                    "fields": {
                        "user": 12,
                        "email": "a@example.com",
                        "validation_hash": "ABC123",
                        "date_hash_added": "2023-06-23T00:00:00.000Z",
                        "is_verified": true
                    }
                },
                {
                "model": "sentry.useremail",
                    "pk": 78,
                    "fields": {
                        "user": 34,
                        "email": "b@example.com",
                        "validation_hash": "ABC123",
                        "date_hash_added": "2023-06-23T00:00:00.000Z",
                        "is_verified": true
                    }
                }
            ]
        """
    )

    # Note that all models are in reverse order for their kind.
    right = json.loads(
        """
            [
                {
                    "model": "sentry.user",
                    "pk": 12,
                    "fields": {
                        "password": "abc123",
                        "last_login": null,
                        "username": "otheruser",
                        "name": "",
                        "email": "b@example.com"
                    }
                },
                {
                    "model": "sentry.user",
                    "pk": 34,
                    "fields": {
                        "password": "abc123",
                        "last_login": null,
                        "username": "someuser",
                        "name": "",
                        "email": "a@example.com"
                    }
                },
                {
                    "model": "sentry.email",
                    "pk": 1,
                    "fields": {
                        "email": "b@example.com",
                        "date_added": "2023-06-22T00:00:00.000Z"
                    }
                },
                {
                    "model": "sentry.email",
                    "pk": 2,
                    "fields": {
                        "email": "a@example.com",
                        "date_added": "2023-06-22T00:00:00.000Z"
                    }
                },
                {
                "model": "sentry.useremail",
                    "pk": 56,
                    "fields": {
                        "user": 12,
                        "email": "b@example.com",
                        "validation_hash": "ABC123",
                        "date_hash_added": "2023-06-23T00:00:00.000Z",
                        "is_verified": true
                    }
                },
                {
                "model": "sentry.useremail",
                    "pk": 78,
                    "fields": {
                        "user": 34,
                        "email": "a@example.com",
                        "validation_hash": "ABC123",
                        "date_hash_added": "2023-06-23T00:00:00.000Z",
                        "is_verified": true
                    }
                }
            ]
        """
    )
    out = validate(left, right)
    findings = out.findings

    assert len(findings) == 0
