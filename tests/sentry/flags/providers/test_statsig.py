import datetime

from sentry.flags.providers import handle_provider_event


def test_statsig_event():
    result = handle_provider_event(
        "statsig",
        [
            {
                "user": {"name": "Test User", "email": "testuser@email.com"},
                "timestamp": 1709660061095,
                "eventName": "statsig::config_change",
                "metadata": {
                    "type": "Gate",
                    "name": "layout_v2",
                    "description": "Description: Change default page layout",
                    "action": "created",
                },
            }
        ],
        1,
    )

    assert result == [
        {
            "action": "created",
            "created_at": datetime.datetime.fromtimestamp(1709660061095 / 1000.0, datetime.UTC),
            "created_by": "testuser@email.com",
            "created_by_type": "email",
            "flag": "layout_v2",
            "organization_id": 1,
            "tags": {},
        }
    ]
