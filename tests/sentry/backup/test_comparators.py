from sentry.backup.comparators import (
    DatetimeEqualityComparator,
    DateUpdatedComparator,
    EmailObfuscatingComparator,
    HashObfuscatingComparator,
)
from sentry.backup.findings import ComparatorFindingKind, InstanceID
from sentry.utils.json import JSONData


def test_good_comparator_both_sides_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 0)
    present: JSONData = {
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
    id = InstanceID("test", 0)
    missing: JSONData = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    assert not cmp.existence(id, missing, missing)


def test_bad_comparator_only_one_side_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 0)
    present: JSONData = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    missing: JSONData = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert res[0]
    assert res[0].on == id
    assert res[0].kind == ComparatorFindingKind.DateUpdatedComparatorExistenceCheck
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "left" in res[0].reason
    assert "my_date_field" in res[0].reason

    res = cmp.existence(id, present, missing)
    assert res
    assert res[0]
    assert res[0].kind == ComparatorFindingKind.DateUpdatedComparatorExistenceCheck
    assert res[0].on == id
    assert res[0].left_pk == 1
    assert res[0].right_pk == 1
    assert "right" in res[0].reason
    assert "my_date_field" in res[0].reason


def test_good_datetime_equality_comparator():
    cmp = DatetimeEqualityComparator("my_date_field")
    id = InstanceID("test", 0)
    left: JSONData = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    right: JSONData = {
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
    id = InstanceID("test", 0)
    left: JSONData = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T00:00:00.000Z",
        },
    }
    right: JSONData = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T00:00:00.123Z",
        },
    }
    res = cmp.compare(id, left, right)
    assert res
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
    id = InstanceID("test", 0)
    left: JSONData = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    right: JSONData = {
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
    id = InstanceID("test", 0)
    left: JSONData = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    right: JSONData = {
        "model": "test",
        "ordinal": 1,
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.001Z",
        },
    }
    res = cmp.compare(id, left, right)
    assert res
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
    id = InstanceID("test", 0)
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
    id = InstanceID("test", 0)
    left: JSONData = {
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
    right: JSONData = {
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


def test_good_email_obfuscating_comparator_scrubbed():
    cmp = EmailObfuscatingComparator("one_email", "many_emails")
    left: JSONData = {
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
    right: JSONData = {
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


def test_good_hash_obfuscating_comparator():
    cmp = HashObfuscatingComparator("one_hash", "many_hashes")
    id = InstanceID("test", 0)
    model: JSONData = {
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
    id = InstanceID("test", 0)
    left: JSONData = {
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
    right: JSONData = {
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


def test_good_hash_obfuscating_comparator_scrubbed():
    cmp = HashObfuscatingComparator("one_hash", "many_hashes")
    left: JSONData = {
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
    right: JSONData = {
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
