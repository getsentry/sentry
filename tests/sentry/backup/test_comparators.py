from sentry.runner.commands.backup import (
    DateUpdatedComparator,
    EmailObfuscatingComparator,
    InstanceID,
)
from sentry.utils.json import JSONData


def test_good_comparator_both_sides_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 1)
    present: JSONData = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    assert not cmp.existence(id, present, present)


def test_good_comparator_neither_side_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 1)
    missing: JSONData = {
        "model": "test",
        "pk": 1,
        "fields": {},
    }
    assert not cmp.existence(id, missing, missing)


def test_bad_comparator_only_one_side_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 1)
    present: JSONData = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    missing: JSONData = {
        "model": "test",
        "pk": 1,
        "fields": {},
    }
    res = cmp.existence(id, missing, present)
    assert res
    assert res[0]
    assert res[0].on == id
    assert res[0].kind == "DateUpdatedComparator"
    assert "left" in res[0].reason
    assert "my_date_field" in res[0].reason

    res = cmp.existence(id, present, missing)
    assert res
    assert res[0]
    assert res[0].on == id
    assert res[0].kind == "DateUpdatedComparator"
    assert "right" in res[0].reason
    assert "my_date_field" in res[0].reason


def test_good_date_updated_comparator():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 1)
    left: JSONData = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    right: JSONData = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.123Z",
        },
    }
    assert not cmp.compare(id, left, right)


def test_bad_date_updated_comparator():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 1)
    left: JSONData = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    right: JSONData = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:00:00.001Z",
        },
    }
    res = cmp.compare(id, left, right)
    assert res
    assert res[0]
    assert res[0].on == id
    assert res[0].kind == "DateUpdatedComparator"


def test_good_email_obfuscating_comparator():
    cmp = EmailObfuscatingComparator("one_email", "many_emails")
    id = InstanceID("test", 1)
    model = {
        "model": "test",
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
    id = InstanceID("test", 1)
    left: JSONData = {
        "model": "test",
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
    assert res[0].on == id
    assert res[0].kind == "EmailObfuscatingComparator"
    assert "a...@...le.com" in res[0].reason
    assert "a...@...ng.com" in res[0].reason

    assert res[1]
    assert res[1].on == id
    assert res[1].kind == "EmailObfuscatingComparator"
    assert "b...@...le.com" in res[1].reason
    assert "b...@...ng.com" in res[1].reason


def test_goo_email_obfuscating_comparator_scrubbed():
    cmp = EmailObfuscatingComparator("one_email", "many_emails")
    left: JSONData = {
        "model": "test",
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
