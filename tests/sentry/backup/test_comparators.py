from sentry.runner.commands.backup import DateUpdatedComparator, InstanceID


def test_good_comparator_both_sides_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 1)
    present = {
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
    missing = {
        "model": "test",
        "pk": 1,
        "fields": {},
    }
    assert not cmp.existence(id, missing, missing)


def test_bad_comparator_only_one_side_existing():
    cmp = DateUpdatedComparator("my_date_field")
    id = InstanceID("test", 1)
    present = {
        "model": "test",
        "pk": 1,
        "fields": {
            "my_date_field": "2023-06-22T23:12:34.567Z",
        },
    }
    missing = {
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
    assert not cmp.compare(id, left, right)


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
    assert res
    assert res[0]
    assert res[0].on == id
    assert res[0].kind == "DateUpdatedComparator"
