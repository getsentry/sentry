import datetime

from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP
from sentry.flags.providers import handle_provider_event


def test_splitio_create_event():
    request_data = {
        "name": "flag_name",
        "type": "Split",
        "changeNumber": 1729714885760,
        "time": 1729714885760,
        "definition": "",
        "description": "",
        "title": "",
        "environmentName": "Prod-Default",
        "environmentId": "eb870720-9179-11ef-86c0-fe8c0d2dbf5a",
        "editor": "colton.allen",
        "schemaVersion": 1,
    }

    assert handle_provider_event("splitio", request_data, 1) == [
        {
            "action": ACTION_MAP["created"],
            "created_at": datetime.datetime(2024, 10, 23, 20, 21, 25, 760000, tzinfo=datetime.UTC),
            "created_by": "colton.allen",
            "created_by_type": CREATED_BY_TYPE_MAP["name"],
            "flag": "flag_name",
            "organization_id": 1,
            "tags": {"environment": "Prod-Default"},
        }
    ]


def test_splitio_update_event():
    request_data = {
        "name": "flag_name",
        "type": "Split",
        "changeNumber": 1729714885760,
        "time": 1729714885760,
        "definition": "",
        "description": "",
        "title": "",
        "environmentName": "Prod-Default",
        "environmentId": "eb870720-9179-11ef-86c0-fe8c0d2dbf5a",
        "editor": "colton.allen",
        "schemaVersion": 1,
        "previous": {
            "name": "flag_name",
            "type": "Split",
            "changeNumber": 1729714818124,
            "time": 1729714818124,
            "definition": "",
            "title": "",
            "environmentName": "Prod-Default",
            "environmentId": "eb870720-9179-11ef-86c0-fe8c0d2dbf5a",
            "editor": "colton.allen",
            "schemaVersion": 1,
        },
    }

    assert handle_provider_event("splitio", request_data, 1) == [
        {
            "action": ACTION_MAP["updated"],
            "created_at": datetime.datetime(2024, 10, 23, 20, 21, 25, 760000, tzinfo=datetime.UTC),
            "created_by": "colton.allen",
            "created_by_type": CREATED_BY_TYPE_MAP["name"],
            "flag": "flag_name",
            "organization_id": 1,
            "tags": {"environment": "Prod-Default"},
        }
    ]


def test_splitio_delete_event():
    request_data = {
        "name": "flag_name",
        "type": "Split",
        "changeNumber": 1729714885760,
        "time": 1729714885760,
        "definition": "",
        "description": "colton.allen deleted feature new_flag with comment ''",
        "title": "",
        "environmentName": "Prod-Default",
        "environmentId": "eb870720-9179-11ef-86c0-fe8c0d2dbf5a",
        "editor": "colton.allen",
        "schemaVersion": 1,
        "previous": {
            "name": "flag_name",
            "type": "Split",
            "changeNumber": 1729714818124,
            "time": 1729714818124,
            "definition": "",
            "title": "",
            "environmentName": "Prod-Default",
            "environmentId": "eb870720-9179-11ef-86c0-fe8c0d2dbf5a",
            "editor": "colton.allen",
            "schemaVersion": 1,
        },
    }

    assert handle_provider_event("splitio", request_data, 1) == [
        {
            "action": ACTION_MAP["deleted"],
            "created_at": datetime.datetime(2024, 10, 23, 20, 21, 25, 760000, tzinfo=datetime.UTC),
            "created_by": "colton.allen",
            "created_by_type": CREATED_BY_TYPE_MAP["name"],
            "flag": "flag_name",
            "organization_id": 1,
            "tags": {"environment": "Prod-Default"},
        }
    ]
