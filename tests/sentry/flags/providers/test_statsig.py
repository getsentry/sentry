from sentry.flags.providers import (
    ACTION_MAP,
    CREATED_BY_TYPE_MAP,
    handle_provider_event,
    timestamp_to_datetime,
)


def test_statsig_create_event():
    result = handle_provider_event(
        "statsig",
        {
            "data": [
                {
                    "user": {"name": "User Name", "email": "user@site.com"},
                    "timestamp": 1729792096601,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "projectName": "sentry",
                        "projectID": "OlmN",
                        "type": "Gate",
                        "name": "new_flag",
                        "description": "Created Gate",
                        "environments": "",
                        "action": "created",
                        "tags": [],
                        "targetApps": [],
                    },
                }
            ]
        },
        1,
    )

    assert result == [
        {
            "action": ACTION_MAP["created"],
            "created_at": timestamp_to_datetime(1729792096601),
            "created_by": "user@site.com",
            "created_by_type": CREATED_BY_TYPE_MAP["email"],
            "flag": "new_flag",
            "organization_id": 1,
            "tags": {},
        }
    ]


def test_statsig_update_event():
    result = handle_provider_event(
        "statsig",
        {
            "data": [
                {
                    "user": {"name": "User Name", "email": "user@site.com"},
                    "timestamp": 1729792096601,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "projectName": "sentry",
                        "projectID": "1pzQ",
                        "type": "Gate",
                        "name": "new_flag",
                        "description": "Updated Config Conditions\n    - Updated rule test pass percentage from 100 to 50",
                        "environments": "development,staging,production",
                        "action": "updated",
                        "tags": [],
                        "targetApps": [],
                    },
                }
            ]
        },
        1,
    )

    assert result == [
        {
            "action": ACTION_MAP["updated"],
            "created_at": timestamp_to_datetime(1729792096601),
            "created_by": "user@site.com",
            "created_by_type": CREATED_BY_TYPE_MAP["email"],
            "flag": "new_flag",
            "organization_id": 1,
            "tags": {},
        }
    ]


def test_statsig_delete_event():
    result = handle_provider_event(
        "statsig",
        {
            "data": [
                {
                    "user": {"name": "User Name", "email": "user@site.com"},
                    "timestamp": 1729792825102,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "projectName": "sentry",
                        "projectID": "1TvW",
                        "type": "Gate",
                        "name": "test_gate",
                        "description": "Deleted Config",
                        "environments": "development,staging,production",
                        "action": "deleted",
                        "tags": [],
                        "targetApps": [],
                    },
                }
            ]
        },
        1,
    )

    assert result == [
        {
            "action": ACTION_MAP["deleted"],
            "created_at": timestamp_to_datetime(1729792825102),
            "created_by": "user@site.com",
            "created_by_type": CREATED_BY_TYPE_MAP["email"],
            "flag": "test_gate",
            "organization_id": 1,
            "tags": {},
        }
    ]


def test_statsig_unknown_event():
    """Assert unknown event types are ignored."""
    result = handle_provider_event(
        "statsig",
        {
            "data": [
                {
                    "user": {"name": "User Name", "email": "user@site.com"},
                    "timestamp": 1729792825102,
                    "eventName": "anything",
                    "metadata": {
                        "projectName": "sentry",
                        "projectID": "1Qr",
                        "type": "Gate",
                        "name": "test_gate",
                        "description": "Deleted Config",
                        "environments": "development,staging,production",
                        "action": "deleted",
                        "tags": [],
                        "targetApps": [],
                    },
                }
            ]
        },
        1,
    )
    assert result == []
