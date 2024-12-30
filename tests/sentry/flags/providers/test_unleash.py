from datetime import datetime, timezone

from sentry.flags.providers import DeserializationError, UnleashProvider


def test_handle_update_no_email():
    items = UnleashProvider(123, "abcdefgh").handle(
        {
            "id": 28,
            "tags": [{"type": "simple", "value": "testvalue"}],
            "type": "feature-environment-enabled",
            "project": "default",
            "createdAt": "2024-12-30T00:00:00.000Z",
            "createdBy": "admin",
            "environment": "development",
            "featureName": "test-flag",
            "createdByUserId": 1,
        }
    )
    assert len(items) == 1
    assert items[0]["action"] == 2
    assert items[0]["created_at"] == datetime(2024, 12, 30, 0, 0, tzinfo=timezone.utc)
    assert items[0]["created_by"] == 1
    assert items[0]["created_by_type"] == 1
    assert items[0]["flag"] == "test-flag"
    assert items[0]["organization_id"] == 123
    assert items[0]["tags"] == {
        "environment": "development",
        "project": "default",
        "simple": "testvalue",
    }


def test_handle_update_with_email():
    items = UnleashProvider(123, "abcdefgh").handle(
        {
            "id": 28,
            "tags": [{"type": "simple", "value": "testvalue"}],
            "type": "feature-environment-enabled",
            "project": "default",
            "createdAt": "2024-12-30T00:00:00.000Z",
            "createdBy": "michelle@michelle.org",
            "environment": "development",
            "featureName": "test-flag",
            "createdByUserId": 1,
        }
    )
    assert len(items) == 1
    assert items[0]["action"] == 2
    assert items[0]["created_at"] == datetime(2024, 12, 30, 0, 0, tzinfo=timezone.utc)
    assert items[0]["created_by"] == "michelle@michelle.org"
    assert items[0]["created_by_type"] == 0
    assert items[0]["flag"] == "test-flag"
    assert items[0]["organization_id"] == 123
    assert items[0]["tags"] == {
        "environment": "development",
        "project": "default",
        "simple": "testvalue",
    }


def test_handle_create():
    items = UnleashProvider(123, "abcdefgh").handle(
        {
            "id": 28,
            "tags": [{"type": "simple", "value": "testvalue"}],
            "type": "feature-created",
            "project": "default",
            "createdAt": "2024-12-30T00:00:00.000Z",
            "createdBy": "michelle@michelle.org",
            "environment": "development",
            "featureName": "test-flag",
            "createdByUserId": 1,
        }
    )
    assert len(items) == 1
    assert items[0]["action"] == 0


def test_handle_junk_action():
    items = UnleashProvider(123, "abcdefgh").handle(
        {
            "id": 28,
            "tags": [{"type": "simple", "value": "testvalue"}],
            "type": "feature-junk",
            "project": "default",
            "createdAt": "2024-12-30T00:00:00.000Z",
            "createdBy": "michelle@michelle.org",
            "environment": "development",
            "featureName": "test-flag",
            "createdByUserId": 1,
        }
    )
    assert len(items) == 0


def test_handle_no_tags():
    items = UnleashProvider(123, "abcdefgh").handle(
        {
            "id": 28,
            "tags": [],
            "type": "feature-environment-enabled",
            "createdAt": "2024-12-30T00:00:00.000Z",
            "createdBy": "michelle@michelle.org",
            "featureName": "test-flag",
            "createdByUserId": 1,
        }
    )
    assert len(items) == 1
    assert items[0]["action"] == 2
    assert items[0]["created_at"] == datetime(2024, 12, 30, 0, 0, tzinfo=timezone.utc)
    assert items[0]["created_by"] == "michelle@michelle.org"
    assert items[0]["created_by_type"] == 0
    assert items[0]["flag"] == "test-flag"
    assert items[0]["organization_id"] == 123
    assert items[0]["tags"] == {}


def test_blank():
    try:
        UnleashProvider(123, "abcdefgh").handle({})
    except DeserializationError as exc:
        assert len(exc.errors) == 4
        assert exc.errors["featureName"][0].code == "required"
        assert exc.errors["type"][0].code == "required"
        assert exc.errors["createdAt"][0].code == "required"
        assert exc.errors["createdBy"][0].code == "required"


def test_partial_fill():
    try:
        UnleashProvider(123, "abcdefgh").handle(
            {
                "id": 28,
                "tags": [{"type": "simple", "value": "testvalue"}],
                "type": "feature-environment-enabled",
                "project": "default",
                "createdAt": "2024-12-30T00:00:00.000Z",
                "createdBy": "admin",
                "environment": "development",
                "createdByUserId": 1,
            }
        )
    except DeserializationError as exc:
        assert exc.errors["featureName"][0].code == "required"
