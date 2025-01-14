from datetime import datetime, timezone

from sentry.flags.providers import DeserializationError, GenericProvider


def test_handle():
    items = GenericProvider(123, None).handle(
        {
            "data": [
                {
                    "action": "created",
                    "change_id": 93899375123,
                    "created_at": "2024-12-12T00:00:00+00:00",
                    "created_by": {"id": "user", "type": "name"},
                    "flag": "test",
                },
                {
                    "action": "created",
                    "change_id": 3284729112,
                    "created_at": "2024-12-12T00:00:00+00:00",
                    "created_by": {"id": "user", "type": "name"},
                    "flag": "other",
                },
            ],
            "meta": {
                "version": 1,
            },
        }
    )
    assert len(items) == 2
    assert items[0]["action"] == 0
    assert items[0]["created_at"] == datetime(2024, 12, 12, 0, 0, tzinfo=timezone.utc)
    assert items[0]["created_by"] == "user"
    assert items[0]["created_by_type"] == 2
    assert items[0]["flag"] == "test"
    assert items[0]["organization_id"] == 123
    assert items[0]["tags"] == {}


def test_handle_dedupe():
    items = GenericProvider(123, None).handle(
        {
            "data": [
                {
                    "action": "created",
                    "change_id": 93899375123,
                    "created_at": "2024-12-12T00:00:00+00:00",
                    "created_by": {"id": "user", "type": "name"},
                    "flag": "test",
                },
                {
                    "action": "created",
                    "change_id": 93899375123,
                    "created_at": "2024-12-12T00:00:00+00:00",
                    "created_by": {"id": "user", "type": "name"},
                    "flag": "test",
                },
            ],
            "meta": {
                "version": 1,
            },
        }
    )
    assert len(items) == 1
    assert items[0]["action"] == 0
    assert items[0]["created_at"] == datetime(2024, 12, 12, 0, 0, tzinfo=timezone.utc)
    assert items[0]["created_by"] == "user"
    assert items[0]["created_by_type"] == 2
    assert items[0]["flag"] == "test"
    assert items[0]["organization_id"] == 123
    assert items[0]["tags"] == {}


def test_blank():
    try:
        GenericProvider(123, None).handle({})
    except DeserializationError as exc:
        assert len(exc.errors) == 2
        assert exc.errors["data"][0].code == "required"
        assert exc.errors["meta"][0].code == "required"


def test_partial_fill():
    try:
        GenericProvider(123, None).handle({"data": [], "meta": {}})
    except DeserializationError as exc:
        assert exc.errors["meta"]["version"][0].code == "required"


def test_empty_data_item():
    try:
        GenericProvider(123, None).handle({"data": [{}], "meta": {"version": 1}})
    except DeserializationError as exc:
        assert len(exc.errors["data"][0]) == 5
        assert exc.errors["data"][0]["action"][0].code == "required"
        assert exc.errors["data"][0]["change_id"][0].code == "required"
        assert exc.errors["data"][0]["created_at"][0].code == "required"
        assert exc.errors["data"][0]["created_by"][0].code == "required"
        assert exc.errors["data"][0]["flag"][0].code == "required"
