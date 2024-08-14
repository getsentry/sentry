from drf_spectacular.utils import OpenApiExample


class EscalationPolicyExamples:
    GET_ESCALATION_POLICY = [
        OpenApiExample(
            "Get detailed view of an escalation policy",
            value={
                "id": "1",
                "name": "Escalation 1",
                "description": "i am a happy escalation path",
                "repeat_n_times": 2,
                "steps": [
                    {
                        "step_number": 1,
                        "escalate_after_sec": 30,
                        "recipients": [
                            {
                                "type": "team",
                                "data": {
                                    "id": "4554497953890304",
                                    "slug": "foo",
                                    "name": "foo",
                                    "isMember": False,
                                    "teamRole": None,
                                    "flags": {"idp:provisioned": False},
                                    "access": frozenset(
                                        {
                                            "alerts:read",
                                            "member:read",
                                            "event:read",
                                            "org:read",
                                            "event:write",
                                            "project:releases",
                                            "team:read",
                                            "project:read",
                                        }
                                    ),
                                    "hasAccess": True,
                                    "isPending": False,
                                    "memberCount": 0,
                                    "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
                                },
                            },
                            {
                                "type": "user",
                                "data": {
                                    "id": 1,
                                    "name": "",
                                    "email": "admin@localhost",
                                    "display_name": "admin@localhost",
                                    "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
                                },
                            },
                        ],
                    }
                ],
            },
            status_codes=["200"],
            response_only=True,
        )
    ]

    LIST_ESCALATION_POLICIES = [
        OpenApiExample(
            "List escalation policies for an organization",
            value=[GET_ESCALATION_POLICY[0].value],
            status_codes=["200"],
            response_only=True,
        )
    ]

    CREATE_OR_UPDATE_ESCALATION_POLICY = [
        OpenApiExample(
            "Create an escalation policy for an organization",
            value={
                "id": "177104",
                "name": "Apdex % Check",
                "description": "i am a happy escalation path",
                "repeat_n_times": 2,
                "team_id": "38432982",
                "user_id": None,
                "steps": [
                    {
                        "escalate_after_sec": 60,
                        "recipients": [
                            {
                                "schedule_id": "38432982",
                            },
                            {
                                "team_id": "38432982",
                            },
                            {
                                "user_id": "38432982",
                            },
                        ],
                    }
                ],
            },
            status_codes=["200", "201"],
            response_only=True,
        )
    ]
