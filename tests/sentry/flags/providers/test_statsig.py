import datetime

from sentry.flags.providers import StatsigProvider


def test_handle_batched_all_actions():
    org_id = 123
    logs = StatsigProvider(org_id, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "user": {"name": "johndoe", "email": "john@sentry.io"},
                    "timestamp": 1739400185198,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "projectName": "sentry",
                        "projectID": "1",
                        "type": "Gate",
                        "name": "gate1",
                        "description": "Updated Config Conditions\n    - Added rule Rule 1",
                        "environments": "development,staging,production",
                        "action": "updated",
                        "tags": [],
                        "targetApps": [],
                    },
                },
                {
                    "user": {"email": "victor@ingolstadt.edu"},
                    "timestamp": 17,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "projectName": "frankenstein",
                        "projectID": "1700",
                        "type": "Gate",
                        "name": "life",
                        "description": "Wretched",
                        "environments": "production",
                        "action": "created",
                        "tags": [],
                        "targetApps": [],
                    },
                },
                {
                    "user": {"name": "johndoe", "email": "john@sentry.io"},
                    "timestamp": 1739400185233,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "projectName": "sentry",
                        "projectID": "1",
                        "type": "Gate",
                        "name": "gate1",
                        "environments": "development,staging",
                        "action": "deleted",
                        "tags": [],
                        "targetApps": [],
                    },
                },
            ]
        }
    )

    assert len(logs) == 3

    assert logs[0]["action"] == 2
    assert logs[0]["created_at"] == datetime.datetime(
        2025, 2, 12, 22, 43, 5, 198000, tzinfo=datetime.UTC
    )
    assert logs[0]["created_by"] == "john@sentry.io"
    assert logs[0]["created_by_type"] == 0
    assert logs[0]["flag"] == "gate1"
    assert logs[0]["organization_id"] == org_id
    assert logs[0]["tags"] == {
        "projectName": "sentry",
        "projectID": "1",
        "environments": "development,staging,production",
    }

    assert logs[1]["action"] == 0
    assert logs[1]["created_at"] == datetime.datetime(
        1970, 1, 1, 0, 0, 0, 17000, tzinfo=datetime.UTC
    )
    assert logs[1]["created_by"] == "victor@ingolstadt.edu"
    assert logs[1]["created_by_type"] == 0
    assert logs[1]["flag"] == "life"
    assert logs[1]["organization_id"] == org_id
    assert logs[1]["tags"] == {
        "projectName": "frankenstein",
        "projectID": "1700",
        "environments": "production",
    }

    assert logs[2]["action"] == 1
    assert logs[2]["created_at"] == datetime.datetime(
        2025, 2, 12, 22, 43, 5, 233000, tzinfo=datetime.UTC
    )
    assert logs[2]["created_by"] == "john@sentry.io"
    assert logs[2]["created_by_type"] == 0
    assert logs[2]["flag"] == "gate1"
    assert logs[2]["organization_id"] == org_id
    assert logs[2]["tags"] == {
        "projectName": "sentry",
        "projectID": "1",
        "environments": "development,staging",
    }


def test_handle_no_user():
    org_id = 123
    logs = StatsigProvider(org_id, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "timestamp": 1739400185198,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "updated",
                    },
                }
            ]
        }
    )

    assert len(logs) == 1
    assert logs[0]["action"] == 2
    assert logs[0]["flag"] == "gate1"
    assert logs[0]["organization_id"] == org_id
    assert logs[0]["created_by"] is None
    assert logs[0]["created_by_type"] is None


def test_handle_no_project_or_environments():
    org_id = 123
    logs = StatsigProvider(org_id, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "timestamp": 1739400185198,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "updated",
                    },
                }
            ]
        }
    )

    assert len(logs) == 1
    assert logs[0]["action"] == 2
    assert logs[0]["flag"] == "gate1"
    assert logs[0]["organization_id"] == org_id


def test_handle_additional_fields():
    org_id = 123
    logs = StatsigProvider(org_id, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "user": {"userID": "456"},
                    "timestamp": 1739400185198,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "updated",
                        "foo": "bar",
                    },
                    # Additional fields (optional)
                    "value": "some value",
                    "statsigMetadata": {"something": 53},
                    "timeUUID": "123e4567-e89b-12d3-a456-426614174000",
                    "unitID": "eureka",
                }
            ]
        }
    )

    assert len(logs) == 1
    assert logs[0]["action"] == 2
    assert logs[0]["flag"] == "gate1"
    assert logs[0]["organization_id"] == org_id


def test_handle_created_by_id():
    logs = StatsigProvider(123, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "user": {"userID": "456"},
                    "timestamp": 1739400185198,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "updated",
                    },
                }
            ]
        }
    )
    assert len(logs) == 1
    assert logs[0]["created_by"] == "456"
    assert logs[0]["created_by_type"] == 1


def test_handle_created_by_id2():
    logs = StatsigProvider(123, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "userID": "456",
                    "timestamp": 1739400185198,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "updated",
                    },
                }
            ]
        }
    )
    assert len(logs) == 1
    assert logs[0]["created_by"] == "456"
    assert logs[0]["created_by_type"] == 1


def test_handle_created_by_name():
    logs = StatsigProvider(123, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "user": {"name": "johndoe"},
                    "timestamp": 1739400185198,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "updated",
                    },
                }
            ]
        }
    )

    assert len(logs) == 1
    assert logs[0]["created_by"] == "johndoe"
    assert logs[0]["created_by_type"] == 2


def test_handle_unsupported_events():
    logs = StatsigProvider(123, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "timestamp": 1739400185198,
                    "eventName": "statsig::gate_exposure",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "updated",
                    },
                },
                {
                    "timestamp": 1739400185199,
                    "eventName": "statsig::config_exposure",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "updated",
                    },
                },
                {
                    "timestamp": 1739400185200,
                    "eventName": "custom event",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "updated",
                    },
                },
            ]
        }
    )
    assert len(logs) == 0


def test_handle_unsupported_config_changes():
    logs = StatsigProvider(123, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "timestamp": 1739400185198,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "type": "Experiment",
                        "name": "hello",
                        "action": "updated",
                    },
                },
                {
                    "timestamp": 1739400185199,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "type": "DynamicConfig",
                        "name": "world",
                        "action": "updated",
                    },
                },
            ]
        }
    )
    assert len(logs) == 0


def test_handle_unsupported_action():
    logs = StatsigProvider(123, "abcdefgh", request_timestamp="1739400185400").handle(
        {
            "data": [
                {
                    "timestamp": 1739400185198,
                    "eventName": "statsig::config_change",
                    "metadata": {
                        "type": "Gate",
                        "name": "gate1",
                        "action": "kickflip",
                    },
                },
            ]
        }
    )
    assert len(logs) == 0
