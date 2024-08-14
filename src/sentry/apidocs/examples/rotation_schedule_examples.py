from drf_spectacular.utils import OpenApiExample


class RotationScheduleExamples:
    GET_ROTATION_SCHEDULE = [
        OpenApiExample(
            "Get detailed view of a rotation schedule",
            value={
                "id": "1",
                "name": "Escalation 1",
                "organization_id": "123",
                "team_id": "48237492",
                "user_id": None,
                "schedule_layers": [
                    {
                        "rotation_type": "weekly",
                        "handoff_time": "0 4 * * 1",
                        "start_time": "2024-01-01T00:00:00+00:00",
                        "schedule_layer_restrictions": {
                            "Sun": [],
                            "Mon": [["08:00", "17:00"]],
                            "Tue": [["08:00", "17:00"]],
                            "Wed": [["08:00", "17:00"]],
                            "Thu": [["08:00", "17:00"]],
                            "Fri": [["08:00", "17:00"]],
                            "Sat": [],
                        },
                        "users": [
                            {
                                "id": 1,
                                "name": "",
                                "email": "admin@localhost",
                                "display_name": "admin@localhost",
                                "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
                            }
                        ],
                    }
                ],
            },
            status_codes=["200"],
            response_only=True,
        )
    ]

    LIST_ROTATION_SCHEDULES = [
        OpenApiExample(
            "List rotation schedules for an organization",
            value=[GET_ROTATION_SCHEDULE[0].value],
            status_codes=["200"],
            response_only=True,
        )
    ]

    CREATE_OR_UPDATE_ROTATION_SCHEDULE = [
        OpenApiExample(
            "Create or update a rotation schedule",
            value={
                "id": "1",
                "name": "Escalation 1",
                "organization_id": "123",
                "team_id": "48237492",
                "user_id": None,
                "schedule_layers": [
                    {
                        "rotation_type": "weekly",
                        "handoff_time": "0 4 * * 1",
                        "start_time": "2024-01-01T00:00:00+00:00",
                        "schedule_layer_restrictions": {
                            "Sun": [],
                            "Mon": [["08:00", "17:00"]],
                            "Tue": [["08:00", "17:00"]],
                            "Wed": [["08:00", "17:00"]],
                            "Thu": [["08:00", "17:00"]],
                            "Fri": [["08:00", "17:00"]],
                            "Sat": [],
                        },
                        "user_ids": ["123", "456"],
                    }
                ],
            },
            status_codes=["200", "201"],
            response_only=True,
        )
    ]
