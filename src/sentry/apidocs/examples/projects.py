from drf_spectacular.utils import OpenApiExample


class PROJECT_EXAMPLES:
    CREATE_NEW_PROJECT = (
        OpenApiExample(
            "Project successfully created",
            value={
                "status": "active",
                "name": "The Spoiled Yoghurt",
                "color": "#bf6e3f",
                "isInternal": False,
                "isPublic": False,
                "slug": "the-spoiled-yoghurt",
                "platform": None,
                "hasAccess": True,
                "firstEvent": None,
                "avatar": {"avatarUuid": None, "avatarType": "letter_avatar"},
                "isMember": False,
                "dateCreated": "2020-08-20T14:36:34.171255Z",
                "isBookmarked": False,
                "id": "5398494",
                "features": [
                    "custom-inbound-filters",
                    "discard-groups",
                    "rate-limits",
                    "data-forwarding",
                    "similarity-view",
                    "issue-alerts-targeting",
                    "servicehooks",
                    "minidump",
                    "similarity-indexing",
                ],
            },
            status_codes=["201"],
        ),
    )
