from copy import deepcopy
from typing import Any

import pytest

from sentry.backup.comparators import (
    AutoSuffixComparator,
    DatetimeEqualityComparator,
    DateUpdatedComparator,
    EmailObfuscatingComparator,
    EqualOrRemovedComparator,
    ForeignKeyComparator,
    HashObfuscatingComparator,
    IgnoredComparator,
    ScrubbedData,
    SecretHexComparator,
    SubscriptionIDComparator,
    UnorderedListComparator,
    UserPasswordObfuscatingComparator,
    UUID4Comparator,
)
from sentry.backup.dependencies import ImportKind, NormalizedModelName, PrimaryKeyMap, dependencies
from sentry.backup.findings import ComparatorFindingKind, InstanceID


def test_good_comparator_both_sides_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    assert not cmp.existence(id, present, present)


def test_good_comparator_neither_side_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    assert not cmp.existence(id, missing, missing)


def test_bad_comparator_only_one_side_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.DateUpdatedComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "my_date_field" in res[0].reason

    res = cmp.existence(id, present, missing)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.DateUpdatedComparatorExistenceCheck
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "right" in res[0].reason
    assert "my_date_field" in res[0].reason


def test_good_comparator_both_sides_null():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    nulled: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": None,
        },
    }
    assert not cmp.existence(id, nulled, nulled)


def test_bad_comparator_only_one_side_null():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    nulled: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": None,
        },
    }
    res = cmp.existence(id, nulled, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.DateUpdatedComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "my_date_field" in res[0].reason

    res = cmp.existence(id, present, nulled)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.DateUpdatedComparatorExistenceCheck
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "right" in res[0].reason
    assert "my_date_field" in res[0].reason


def test_good_comparator_one_side_null_other_side_missing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    nulled: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": None,
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, nulled)
    assert not res

    res = cmp.existence(id, nulled, missing)
    assert not res


def test_good_auto_suffix_comparator():
    cmp = AutoSuffixComparator("same", "suffixed")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "foo-bar",
            "suffixed": "foo-bar",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "foo-bar",
            "suffixed": "foo-bar-baz",
        },
    }
    assert not cmp.compare(id, left, right)


def test_bad_auto_suffix_comparator():
    cmp = AutoSuffixComparator("same", "suffixed")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "foo-bar",
            "suffixed": "foo-bar",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "unequal",
            "suffixed": "foo-barbaz",
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 2

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.AutoSuffixComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "foo-bar" in res[0].reason
    assert "unequal" in res[0].reason

    assert res[1]
    assert res[1].kind == ComparatorFindingKind.AutoSuffixComparator
    assert res[1].on == id
    assert res[1].left_pk == 1
    assert res[1].right_pk == 1
    assert "foo-bar" in res[1].reason
    assert "foo-barbaz" in res[1].reason


def test_good_auto_suffix_comparator_existence():
    cmp = AutoSuffixComparator("auto_suffix_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "auto_suffix_field": "foo-bar",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.AutoSuffixComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "`auto_suffix_field`" in res[0].reason


def test_good_auto_suffix_comparator_scrubbed():
    cmp = AutoSuffixComparator("same", "suffixed")
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "foo-bar",
            "suffixed": "foo-bar",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "foo-bar",
            "suffixed": "foo-bar-baz",
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["AutoSuffixComparator::same"] is ScrubbedData()
    assert left["scrubbed"]["AutoSuffixComparator::suffixed"] is ScrubbedData()

    assert right["scrubbed"]
    assert right["scrubbed"]["AutoSuffixComparator::same"] is ScrubbedData()
    assert right["scrubbed"]["AutoSuffixComparator::suffixed"] is ScrubbedData()


def test_good_datetime_equality_comparator():
    cmp = DatetimeEqualityComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    assert not cmp.compare(id, left, right)


def test_bad_datetime_equality_comparator():
    cmp = DatetimeEqualityComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T00:00:00.000Z",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T00:00:00.123Z",
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.DatetimeEqualityComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`my_date_field`" in res[0].reason
    assert "left value (2023-06-22T00:00:00.000Z)" in res[0].reason
    assert "right value (2023-06-22T00:00:00.123Z)" in res[0].reason


def test_good_date_updated_comparator():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    assert not cmp.compare(id, left, right)


def test_bad_date_updated_comparator():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.001Z",
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.DateUpdatedComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`my_date_field`" in res[0].reason
    assert "left value (2023-06-22T23:12:34.567Z)" in res[0].reason
    assert "right value (2023-06-22T23:00:00.001Z)" in res[0].reason


def test_good_email_obfuscating_comparator():
    cmp = EmailObfuscatingComparator("one_email", "many_emails")
    id = InstanceID("sentry.test", 0)
    model = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_email": "a@example.com",
            "many_emails": [
                "b@example.com",
                "c@example.com",
            ],
        },
    }
    assert not cmp.compare(id, model, model)


def test_bad_email_obfuscating_comparator():
    cmp = EmailObfuscatingComparator("one_email", "many_emails")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_email": "alpha@example.com",
            "many_emails": [
                "bravo@example.com",
                "charlie@example.com",
            ],
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_email": "alice@testing.com",
            "many_emails": [
                "brian@testing.com",
                "charlie@example.com",
            ],
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 2

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.EmailObfuscatingComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "b...@...le.com" in res[0].reason
    assert "b...@...ng.com" in res[0].reason

    assert res[1]
    assert res[1].kind == ComparatorFindingKind.EmailObfuscatingComparator
    assert res[1].on == id
    assert res[1].left_pk == 1
    assert res[1].right_pk == 1
    assert "a...@...le.com" in res[1].reason
    assert "a...@...ng.com" in res[1].reason


def test_good_email_obfuscating_comparator_existence():
    cmp = EmailObfuscatingComparator("email_obfuscating_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "email_obfuscating_field": "brian@testing.com",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.EmailObfuscatingComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "`email_obfuscating_field`" in res[0].reason


def test_good_email_obfuscating_comparator_scrubbed():
    cmp = EmailObfuscatingComparator("one_email", "many_emails")
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_email": "alpha@example.com",
            "many_emails": [
                "bravo@example.com",
                "charlie@example.com",
            ],
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_email": "alice@testing.com",
            "many_emails": [
                "brian@testing.com",
                "charlie@example.com",
            ],
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["EmailObfuscatingComparator::one_email"] == ["a...@...le.com"]
    assert left["scrubbed"]["EmailObfuscatingComparator::many_emails"] == [
        "b...@...le.com",
        "c...@...le.com",
    ]

    assert right["scrubbed"]
    assert right["scrubbed"]["EmailObfuscatingComparator::one_email"] == ["a...@...ng.com"]
    assert right["scrubbed"]["EmailObfuscatingComparator::many_emails"] == [
        "b...@...ng.com",
        "c...@...le.com",
    ]


def test_good_equal_or_removed_comparator_equal():
    cmp = EqualOrRemovedComparator("my_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": "foo",
        },
    }

    assert not cmp.existence(id, present, present)
    assert not cmp.compare(id, present, present)


def test_good_equal_or_removed_comparator_not_equal():
    cmp = EqualOrRemovedComparator("my_field")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": "foo",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": "bar",
        },
    }

    assert not cmp.existence(id, left, right)

    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.EqualOrRemovedComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "my_field" in res[0].reason
    assert "foo" in res[0].reason
    assert "bar" in res[0].reason


def test_good_equal_or_removed_comparator_neither_side_existing():
    cmp = EqualOrRemovedComparator("my_field")
    id = InstanceID("sentry.test", 0)
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    assert not cmp.existence(id, missing, missing)


def test_good_equal_or_removed_comparator_only_right_side_missing():
    cmp = EqualOrRemovedComparator("my_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": "foo",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    assert not cmp.existence(id, present, missing)
    assert not cmp.compare(id, present, missing)


def test_bad_equal_or_removed_comparator_only_left_side_missing():
    cmp = EqualOrRemovedComparator("my_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": "foo",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.EqualOrRemovedComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "my_field" in res[0].reason


def test_good_equal_or_removed_comparator_both_sides_nulled():
    cmp = EqualOrRemovedComparator("my_field")
    id = InstanceID("sentry.test", 0)
    nulled: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": None,
        },
    }
    assert not cmp.existence(id, nulled, nulled)


def test_good_equal_or_removed_comparator_only_right_side_nulled():
    cmp = EqualOrRemovedComparator("my_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": "foo",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": None,
        },
    }
    assert not cmp.existence(id, present, missing)
    assert not cmp.compare(id, present, missing)


def test_bad_equal_or_removed_comparator_only_left_side_nulled():
    cmp = EqualOrRemovedComparator("my_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": "foo",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_field": None,
        },
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.EqualOrRemovedComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "my_field" in res[0].reason


def test_good_hash_obfuscating_comparator():
    cmp = HashObfuscatingComparator("one_hash", "many_hashes")
    id = InstanceID("sentry.test", 0)
    model: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_hash": "1239fe0ab0afc39b",
            "many_hashes": [
                "190dae4e",
                "1234",
            ],
        },
    }
    assert not cmp.compare(id, model, model)


def test_bad_hash_obfuscating_comparator():
    cmp = HashObfuscatingComparator("one_hash", "many_hashes")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_hash": "1239fe0ab0afc39b",
            "many_hashes": [
                "190dae4e",
                "1234",
            ],
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_hash": "1249fe0ab0afc39c",
            "many_hashes": [
                "290dae4f",
                "1234",
            ],
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 2

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.HashObfuscatingComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "1...e" in res[0].reason
    assert "2...f" in res[0].reason

    assert res[1]
    assert res[1].kind == ComparatorFindingKind.HashObfuscatingComparator
    assert res[1].on == id
    assert res[1].left_pk == 1
    assert res[1].right_pk == 1
    assert "123...39b" in res[1].reason
    assert "124...39c" in res[1].reason


def test_good_hash_obfuscating_comparator_existence():
    cmp = HashObfuscatingComparator("hash_obfuscating_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "hash_obfuscating_field": "foo",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.HashObfuscatingComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "`hash_obfuscating_field`" in res[0].reason


def test_good_hash_obfuscating_comparator_scrubbed():
    cmp = HashObfuscatingComparator("one_hash", "many_hashes")
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_hash": "1239fe0ab0afc39b",
            "many_hashes": [
                "190dae4e",
                "1234",
            ],
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "one_hash": "1249fe0ab0afc39c",
            "many_hashes": [
                "290dae4f",
                "1234",
            ],
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["HashObfuscatingComparator::one_hash"] == ["123...39b"]
    assert left["scrubbed"]["HashObfuscatingComparator::many_hashes"] == [
        "1...e",
        "...",
    ]

    assert right["scrubbed"]
    assert right["scrubbed"]["HashObfuscatingComparator::one_hash"] == ["124...39c"]
    assert right["scrubbed"]["HashObfuscatingComparator::many_hashes"] == [
        "2...f",
        "...",
    ]


def test_good_foreign_key_comparator():
    deps = dependencies()
    cmp = ForeignKeyComparator(
        {k: v.model for k, v in deps[NormalizedModelName("sentry.UserEmail")].foreign_keys.items()}
    )
    id = InstanceID("sentry.useremail", 0)
    left_pk_map = PrimaryKeyMap()
    left_pk_map.insert(NormalizedModelName("sentry.user"), 12, 1, ImportKind.Inserted)
    right_pk_map = PrimaryKeyMap()
    right_pk_map.insert(NormalizedModelName("sentry.user"), 34, 1, ImportKind.Inserted)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 12,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 34,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    cmp.set_primary_key_maps(left_pk_map, right_pk_map)

    assert not cmp.compare(id, left, right)


def test_good_foreign_key_comparator_existence():
    deps = dependencies()
    cmp = ForeignKeyComparator(
        {k: v.model for k, v in deps[NormalizedModelName("sentry.UserEmail")].foreign_keys.items()}
    )
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 12,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.ForeignKeyComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "`user`" in res[0].reason


def test_good_foreign_key_comparator_scrubbed():
    deps = dependencies()
    cmp = ForeignKeyComparator(
        {k: v.model for k, v in deps[NormalizedModelName("sentry.UserEmail")].foreign_keys.items()}
    )
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 12,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    right = deepcopy(left)
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["ForeignKeyComparator::user"] is ScrubbedData()

    assert right["scrubbed"]
    assert right["scrubbed"]["ForeignKeyComparator::user"] is ScrubbedData()


def test_bad_foreign_key_comparator_set_primary_key_maps_not_called():
    deps = dependencies()
    cmp = ForeignKeyComparator(
        {k: v.model for k, v in deps[NormalizedModelName("sentry.UserEmail")].foreign_keys.items()}
    )
    id = InstanceID("sentry.useremail", 0)
    left_pk_map = PrimaryKeyMap()
    left_pk_map.insert(NormalizedModelName("sentry.user"), 12, 1, ImportKind.Inserted)
    right_pk_map = PrimaryKeyMap()
    right_pk_map.insert(NormalizedModelName("sentry.user"), 34, 1, ImportKind.Inserted)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 12,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 34,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }

    with pytest.raises(RuntimeError):
        cmp.compare(id, left, right)


def test_bad_foreign_key_comparator_unequal_mapping():
    deps = dependencies()
    cmp = ForeignKeyComparator(
        {k: v.model for k, v in deps[NormalizedModelName("sentry.UserEmail")].foreign_keys.items()}
    )
    id = InstanceID("sentry.useremail", 0)
    left_pk_map = PrimaryKeyMap()
    left_pk_map.insert(NormalizedModelName("sentry.user"), 12, 1, ImportKind.Inserted)
    right_pk_map = PrimaryKeyMap()
    right_pk_map.insert(NormalizedModelName("sentry.user"), 34, 2, ImportKind.Inserted)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 12,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 34,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    cmp.set_primary_key_maps(left_pk_map, right_pk_map)

    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.ForeignKeyComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`user`" in res[0].reason
    assert "left foreign key ordinal (1)" in res[0].reason
    assert "right foreign key ordinal (2)" in res[0].reason


def test_bad_foreign_key_comparator_missing_mapping():
    deps = dependencies()
    cmp = ForeignKeyComparator(
        {k: v.model for k, v in deps[NormalizedModelName("sentry.UserEmail")].foreign_keys.items()}
    )
    id = InstanceID("sentry.useremail", 0)
    left_pk_map = PrimaryKeyMap()
    right_pk_map = PrimaryKeyMap()
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 12,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "user": 34,
            "email": "testing@example.com",
            "validation_hash": "ABC123",
            "date_hash_added": "2023-06-23T00:00:00.000Z",
            "is_verified": True,
        },
    }
    cmp.set_primary_key_maps(left_pk_map, right_pk_map)

    res = cmp.compare(id, left, right)
    assert len(res) == 2

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.ForeignKeyComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`user`" in res[0].reason
    assert "left foreign key ordinal" in res[0].reason
    assert "pk `12`" in res[0].reason

    assert res[1]
    assert res[1].kind == ComparatorFindingKind.ForeignKeyComparator
    assert res[1].on == id
    assert res[1].left_pk == 1
    assert res[1].right_pk == 1
    assert "`user`" in res[1].reason
    assert "right foreign key ordinal" in res[1].reason
    assert "pk `34`" in res[1].reason


def test_good_ignored_comparator():
    cmp = IgnoredComparator("ignored_field")
    id = InstanceID("sentry.test", 0)
    model: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "ignored_field": "IGNORE_ME!",
            "other_field": "...but still look at me",
        },
    }
    assert not cmp.compare(id, model, model)


def test_good_ignored_comparator_existence():
    cmp = IgnoredComparator("ignored_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "ignored_field": "foo",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert not res


def test_good_ignored_comparator_scrubbed():
    cmp = IgnoredComparator("ignored_field")
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "ignored_field": "IGNORE_ME!",
            "other_field": "...but still look at me",
        },
    }
    right = deepcopy(left)
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["IgnoredComparator::ignored_field"] is ScrubbedData()
    assert left["scrubbed"].get("IgnoredComparator::other_field") is None

    assert right["scrubbed"]
    assert right["scrubbed"]["IgnoredComparator::ignored_field"] is ScrubbedData()
    assert right["scrubbed"].get("IgnoredComparator::other_field") is None


def test_good_secret_hex_comparator():
    cmp = SecretHexComparator(8, "equal", "unequal")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "equal": "3e04f551c7219550",
            "unequal": "3e04f551c7219550",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "equal": "3e04f551c7219550",
            "unequal": "50a7e2c7e3ca35fc",
        },
    }
    assert not cmp.compare(id, left, right)


def test_bad_secret_hex_comparator():
    cmp = SecretHexComparator(8, "same", "invalid_left", "invalid_right")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "3e04f551c7219550",
            "invalid_left": "foo",
            "invalid_right": "50a7e2c7e3ca35fc",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "3e04f551c7219550",
            "invalid_left": "50a7e2c7e3ca35fc",
            "invalid_right": "bar",
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 2

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.SecretHexComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`invalid_left`" in res[0].reason
    assert "left" in res[0].reason
    assert "regex" in res[0].reason
    assert "foo" in res[0].reason

    assert res[1]
    assert res[1].kind == ComparatorFindingKind.SecretHexComparator
    assert res[1].on == id
    assert res[1].left_pk == 1
    assert res[1].right_pk == 1
    assert "`invalid_right`" in res[1].reason
    assert "right" in res[1].reason
    assert "regex" in res[1].reason
    assert "bar" in res[1].reason


def test_good_secret_hex_comparator_scrubbed():
    cmp = SecretHexComparator(8, "secret_hex_field")
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "secret_hex_field": "3e04f551c7219550",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "secret_hex_field": "3e04f551c7219550",
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["SecretHexComparator::secret_hex_field"] is ScrubbedData()

    assert right["scrubbed"]
    assert right["scrubbed"]["SecretHexComparator::secret_hex_field"] is ScrubbedData()


def test_good_subscription_id_comparator():
    cmp = SubscriptionIDComparator("subscription_id_field")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "subscription_id_field": "0/12363aae153911eeac590242ac130004",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "subscription_id_field": "0/45663aae153911eeac590242acabc123",
        },
    }
    assert not cmp.compare(id, left, right)


def test_bad_subscription_id_comparator():
    cmp = SubscriptionIDComparator("same", "invalid_left", "invalid_right")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "0/12363aae153911eeac590242ac130004",
            "invalid_left": "12363aae153911eeac590242ac130004",
            "invalid_right": "0/12363aae153911eeac590242ac130004",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "0/12363aae153911eeac590242ac130004",
            "invalid_left": "0/12363aae153911eeac590242ac130004",
            "invalid_right": "0/foobar",
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 3

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.SubscriptionIDComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`same`" in res[0].reason
    assert "equal" in res[0].reason
    assert "0/12363aae153911eeac590242ac130004" in res[0].reason

    assert res[1]
    assert res[1].kind == ComparatorFindingKind.SubscriptionIDComparator
    assert res[1].on == id
    assert res[1].left_pk == 1
    assert res[1].right_pk == 1
    assert "`invalid_left`" in res[1].reason
    assert "left" in res[1].reason
    assert "regex" in res[1].reason
    assert "12363aae153911eeac590242ac130004" in res[1].reason

    assert res[2]
    assert res[2].kind == ComparatorFindingKind.SubscriptionIDComparator
    assert res[2].on == id
    assert res[2].left_pk == 1
    assert res[2].right_pk == 1
    assert "`invalid_right`" in res[2].reason
    assert "right" in res[2].reason
    assert "regex" in res[2].reason
    assert "0/foobar" in res[2].reason


def test_good_subscription_id_comparator_existence():
    cmp = SubscriptionIDComparator("subscription_id_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "subscription_id_field": "0/45663aae153911eeac590242acabc123",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.SubscriptionIDComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "`subscription_id_field`" in res[0].reason


def test_good_subscription_id_comparator_scrubbed():
    cmp = SubscriptionIDComparator("subscription_id_field")
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "subscription_id_field": "0/12363aae153911eeac590242ac130004",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "subscription_id_field": "0/45663aae153911eeac590242acabc123",
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["SubscriptionIDComparator::subscription_id_field"] is ScrubbedData()

    assert right["scrubbed"]
    assert right["scrubbed"]["SubscriptionIDComparator::subscription_id_field"] is ScrubbedData()


def test_good_unordered_list_comparator():
    cmp = UnorderedListComparator("ordered", "unordered")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "ordered": ["a", "b", "c"],
            "unordered": ["b", "a", "c"],
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "ordered": ["a", "b", "c"],
            "unordered": ["c", "b", "a"],
        },
    }
    assert not cmp.compare(id, left, right)


def test_bad_unordered_list_comparator():
    cmp = UnorderedListComparator("unequal")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "unequal": ["b", "a"],
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "unequal": ["a", "b", "c"],
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.UnorderedListComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`unequal`" in res[0].reason
    assert "not equal" in res[0].reason
    assert "['b', 'a']" in res[0].reason
    assert "['a', 'b', 'c']" in res[0].reason


def test_good_unordered_list_comparator_existence():
    cmp = UnorderedListComparator("unordered_list_field")
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "unordered_list_field": ["a", "b", "c"],
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.UnorderedListComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "`unordered_list_field`" in res[0].reason


def test_good_unordered_list_comparator_scrubbed():
    cmp = UnorderedListComparator("unordered_list_field")
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "unordered_list_field": ["a", "b", "c"],
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "unordered_list_field": ["a", "b", "c"],
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["UnorderedListComparator::unordered_list_field"] is ScrubbedData()

    assert right["scrubbed"]
    assert right["scrubbed"]["UnorderedListComparator::unordered_list_field"] is ScrubbedData()


def test_good_uuid4_comparator():
    cmp = UUID4Comparator("guid_field")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "guid_field": "4c79eea3-8a71-4b99-b291-1f6a906fbb47",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "guid_field": "bb41a040-b413-4b89-aa03-179470d9ee05",
        },
    }
    assert not cmp.compare(id, left, right)


def test_bad_uuid4_comparator():
    cmp = UUID4Comparator("same", "invalid_left", "invalid_right")
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "4c79eea3-8a71-4b99-b291-1f6a906fbb47",
            "invalid_left": "foo",
            "invalid_right": "bb41a040-b413-4b89-aa03-179470d9ee05",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "same": "4c79eea3-8a71-4b99-b291-1f6a906fbb47",
            "invalid_left": "bb41a040-b413-4b89-aa03-179470d9ee05",
            "invalid_right": "bar",
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 3

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.UUID4Comparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`same`" in res[0].reason
    assert "equal" in res[0].reason
    assert "4c79eea3-8a71-4b99-b291-1f6a906fbb47" in res[0].reason

    assert res[1]
    assert res[1].kind == ComparatorFindingKind.UUID4Comparator
    assert res[1].on == id
    assert res[1].left_pk == 1
    assert res[1].right_pk == 1
    assert "`invalid_left`" in res[1].reason
    assert "left" in res[1].reason
    assert "regex" in res[1].reason
    assert "foo" in res[1].reason

    assert res[2]
    assert res[2].kind == ComparatorFindingKind.UUID4Comparator
    assert res[2].on == id
    assert res[2].left_pk == 1
    assert res[2].right_pk == 1
    assert "`invalid_right`" in res[2].reason
    assert "right" in res[2].reason
    assert "regex" in res[2].reason
    assert "bar" in res[2].reason


def test_good_uuid4_comparator_scrubbed():
    cmp = UUID4Comparator("guid_field")
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "guid_field": "4c79eea3-8a71-4b99-b291-1f6a906fbb47",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "guid_field": "4c79eea3-8a71-4b99-b291-1f6a906fbb47",
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["UUID4Comparator::guid_field"] is ScrubbedData()

    assert right["scrubbed"]
    assert right["scrubbed"]["UUID4Comparator::guid_field"] is ScrubbedData()


def test_good_user_password_obfuscating_comparator_claimed_user():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    model: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": None,
            "is_password_expired": False,
        },
    }
    assert not cmp.compare(id, model, model)


def test_good_user_password_obfuscating_comparator_claimed_user_never_changed_password():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": None,
            "is_password_expired": True,
        },
    }
    nulled: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
        },
    }
    assert not cmp.compare(id, missing, missing)
    assert not cmp.compare(id, nulled, nulled)
    assert not cmp.compare(id, nulled, missing)
    assert not cmp.compare(id, missing, nulled)


def test_good_user_password_obfuscating_comparator_newly_unclaimed_user():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": True,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$HabqnqSUf1q5nKLC24gRMF$tEH6ZbeBSx21Pk8DJO2w5+/NiEI77N2MS3D6QF+Qayg=",
            "last_password_change": "2023-07-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    assert not cmp.compare(id, left, right)


def test_good_user_password_obfuscating_comparator_newly_unclaimed_user_never_changed_password():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": None,
            "is_password_expired": False,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$HabqnqSUf1q5nKLC24gRMF$tEH6ZbeBSx21Pk8DJO2w5+/NiEI77N2MS3D6QF+Qayg=",
            "last_password_change": "2023-07-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    assert not cmp.compare(id, left, right)


def test_good_user_password_obfuscating_comparator_already_unclaimed_user():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$HabqnqSUf1q5nKLC24gRMF$tEH6ZbeBSx21Pk8DJO2w5+/NiEI77N2MS3D6QF+Qayg=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    assert not cmp.compare(id, left, right)


def test_bad_user_password_obfuscating_comparator_claimed_user_password_changed():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            # Absence of `is_unclaimed` is treated as `False`.
            "password": "pbkdf2_sha256$260000$HabqnqSUf1q5nKLC24gRMF$tEH6ZbeBSx21Pk8DJO2w5+/NiEI77N2MS3D6QF+Qayg=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.UserPasswordObfuscatingComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`password`" in res[0].reason
    assert "pbkdf2_sha25...OCTiw=" in res[0].reason
    assert "pbkdf2_sha25...+Qayg=" in res[0].reason


def test_bad_user_password_obfuscating_comparator_newly_unclaimed_user_password_unchanged():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            # Absence of `is_unclaimed` is treated as `False`.
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.UserPasswordObfuscatingComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`password`" in res[0].reason
    assert res[0].reason.count("pbkdf2_sha25...OCTiw=") == 2


def test_bad_user_password_obfuscating_comparator_already_unclaimed_user_password_unchanged():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.UserPasswordObfuscatingComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`password`" in res[0].reason
    assert res[0].reason.count("pbkdf2_sha25...OCTiw=") == 2


def test_bad_user_password_obfuscating_comparator_impossible_newly_claimed_user():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.UserPasswordObfuscatingComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`is_unclaimed`" in res[0].reason
    assert "cannot claim" in res[0].reason


def test_bad_user_password_obfuscating_comparator_unclaimed_user_last_password_change_nulled():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$HabqnqSUf1q5nKLC24gRMF$tEH6ZbeBSx21Pk8DJO2w5+/NiEI77N2MS3D6QF+Qayg=",
            "last_password_change": None,
            "is_password_expired": False,
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.UserPasswordObfuscatingComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`last_password_change`" in res[0].reason
    assert "less than" in res[0].reason


def test_bad_user_password_obfuscating_comparator_already_unclaimed_user_password_unexpired():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": False,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$HabqnqSUf1q5nKLC24gRMF$tEH6ZbeBSx21Pk8DJO2w5+/NiEI77N2MS3D6QF+Qayg=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": True,
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.UserPasswordObfuscatingComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`is_password_expired`" in res[0].reason


def test_bad_user_password_obfuscating_comparator_newly_unclaimed_user_password_still_expired():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": True,
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$HabqnqSUf1q5nKLC24gRMF$tEH6ZbeBSx21Pk8DJO2w5+/NiEI77N2MS3D6QF+Qayg=",
            "last_password_change": "2023-06-23T00:00:00.000Z",
            "is_password_expired": True,
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].kind == ComparatorFindingKind.UserPasswordObfuscatingComparator
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "`is_password_expired`" in res[0].reason
    assert "False" in res[0].reason


def test_good_user_password_obfuscating_comparator_existence():
    cmp = UserPasswordObfuscatingComparator()
    id = InstanceID("sentry.test", 0)
    present: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
        },
    }
    missing: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert len(res) == 1

    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.UserPasswordObfuscatingComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "`password`" in res[0].reason


def test_good_user_password_obfuscating_comparator_scrubbed_long():
    cmp = UserPasswordObfuscatingComparator()
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "pbkdf2_sha256$260000$3v4Cyy3TAhp14YCB8Zh7Gq$SjB35BELrwwfOCaiz8O/SdbvhXq+l02BRpKtwxOCTiw=",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "pbkdf2_sha256$260000$HabqnqSUf1q5nKLC24gRMF$tEH6ZbeBSx21Pk8DJO2w5+/NiEI77N2MS3D6QF+Qayg=",
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["UserPasswordObfuscatingComparator::password"] == [
        "pbkdf2_sha25...OCTiw="
    ]

    assert right["scrubbed"]
    assert right["scrubbed"]["UserPasswordObfuscatingComparator::password"] == [
        "pbkdf2_sha25...+Qayg="
    ]


def test_good_user_password_obfuscating_comparator_scrubbed_medium():
    cmp = UserPasswordObfuscatingComparator()
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "sha1$abc123$a0aac0d9559f1e7f4b6931f3918e72ad8ec01c04",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "sha1$abc123$1e3c01a9c0b08c3579b50eaf19bf144fa4324d4d",
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["UserPasswordObfuscatingComparator::password"] == ["sha1$a...1c04"]

    assert right["scrubbed"]
    assert right["scrubbed"]["UserPasswordObfuscatingComparator::password"] == ["sha1$a...4d4d"]


def test_good_user_password_obfuscating_comparator_scrubbed_short():
    cmp = UserPasswordObfuscatingComparator()
    left: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": False,
            "password": "md5$abc$d2315d2c3883695e40598e56792847ab",
        },
    }
    right: Any = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "is_unclaimed": True,
            "password": "md5$abc$161b6bc86389b8b1fe6e8390e9618c9d",
        },
    }
    cmp.scrub(left, right)
    assert left["scrubbed"]
    assert left["scrubbed"]["UserPasswordObfuscatingComparator::password"] == ["..."]

    assert right["scrubbed"]
    assert right["scrubbed"]["UserPasswordObfuscatingComparator::password"] == ["..."]
