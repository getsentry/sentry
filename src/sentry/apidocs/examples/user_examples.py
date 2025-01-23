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
