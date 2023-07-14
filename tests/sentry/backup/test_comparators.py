from sentry.runner.commands.backup import DateUpdatedComparator, InstanceID


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
    assert res.kind == "DateUpdatedComparator"
