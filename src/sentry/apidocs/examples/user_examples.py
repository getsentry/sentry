from drf_spectacular.utils import OpenApiExample


class UserExamples:
    LIST_ORGANIZATIONS = [
        OpenApiExample(
            "List your organizations",
            value=[
                {
                    "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
                    "dateCreated": "2018-11-06T21:19:55.101Z",
                    "features": [
                        "session-replay-video",
                        "onboarding",
                        "advanced-search",
                        "monitor-seat-billing",
                        "issue-platform",
                    ],
                    "hasAuthProvider": False,
                    "id": "2",
                    "isEarlyAdopter": False,
                    "allowMemberInvite": True,
                    "allowMemberProjectCreation": True,
                    "allowSuperuserAccess": False,
                    "links": {
                        "organizationUrl": "https://the-interstellar-jurisdiction.sentry.io",
                        "regionUrl": "https://us.sentry.io",
                    },
                    "name": "The Interstellar Jurisdiction",
                    "require2FA": False,
                    "slug": "the-interstellar-jurisdiction",
                    "status": {"id": "active", "name": "active"},
                }
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_USER_DETAILS = [
        OpenApiExample(
            "Retrieve your user details",
            value={
                "id": "1",
                "name": "Jane Doe",
                "username": "jane@example.com",
                "email": "jane@example.com",
                "avatarUrl": "https://gravatar.com/avatar/0123456789abcdef0123456789abcdef?s=32&d=mm",
                "isActive": True,
                "isSuspended": False,
                "hasPasswordAuth": True,
                "isManaged": False,
                "dateJoined": "2023-03-01T17:42:12.547383Z",
                "lastLogin": "2024-07-16T15:36:46.048343Z",
                "has2fa": True,
                "lastActive": "2024-07-17T09:12:44.104915Z",
                "isSuperuser": False,
                "isStaff": False,
                "experiments": {},
                "emails": [{"id": "1", "email": "jane@example.com", "is_verified": True}],
                "options": {
                    "theme": "system",
                    "language": "en",
                    "stacktraceOrder": -1,
                    "defaultIssueEvent": "recommended",
                    "timezone": "UTC",
                    "clock24Hours": False,
                    "prefersIssueDetailsStreamlinedUI": None,
                },
                "flags": {"newsletter_consent_prompt": False},
                "avatar": {"avatarType": "letter_avatar", "avatarUuid": None, "avatarUrl": None},
                "identities": [],
                "authenticators": [
                    {
                        "id": "1",
                        "type": "totp",
                        "name": "Authenticator App",
                        "dateCreated": "2023-03-01T17:45:01.120941Z",
                        "dateUsed": "2024-07-16T15:36:40.501876Z",
                    }
                ],
                "permissions": [],
            },
            status_codes=["200"],
            response_only=True,
        )
    ]

    RETRIEVE_API_INDEX = [
        OpenApiExample(
            "Retrieve the current credentials",
            value={
                "version": "0",
                "auth": {"scopes": ["org:read", "project:read"]},
                "user": {
                    "id": "1",
                    "name": "Jane Bloggs",
                    "username": "jane@example.com",
                    "email": "jane@example.com",
                    "avatarUrl": "https://gravatar.com/avatar/1d4e7f2c9b3a?s=32&d=mm",
                    "isActive": True,
                    "isSuspended": False,
                    "hasPasswordAuth": True,
                    "isManaged": False,
                    "dateJoined": "2023-03-01T18:12:42.000000Z",
                    "lastLogin": "2026-11-02T09:31:05.000000Z",
                    "has2fa": True,
                    "lastActive": "2026-11-07T15:20:11.000000Z",
                    "isSuperuser": False,
                    "isStaff": False,
                    "emails": [{"id": "1", "email": "jane@example.com", "is_verified": True}],
                    "experiments": {},
                    "options": {
                        "theme": "system",
                        "language": "en",
                        "stacktraceOrder": -1,
                        "defaultIssueEvent": "recommended",
                        "timezone": "UTC",
                        "clock24Hours": False,
                        "prefersIssueDetailsStreamlinedUI": None,
                    },
                    "flags": {"newsletter_consent_prompt": False},
                    "avatar": {
                        "avatarType": "letter_avatar",
                        "avatarUuid": None,
                        "avatarUrl": None,
                    },
                    "identities": [],
                },
            },
            status_codes=["200"],
            response_only=True,
        )
    ]
