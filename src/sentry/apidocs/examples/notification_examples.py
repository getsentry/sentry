from drf_spectacular.utils import OpenApiExample

from sentry.apidocs.examples.project_examples import project

CREATE_NOTIFICATION_ACTION = [
    OpenApiExample(
        "Create a new email Notification Action for The Spoiled Yoghurt project spike protection",
        value=[
            {
                "id": "836501735",
                "organizationId": "62848264",
                "integrationId": "null",
                "sentryAppId": "null",
                "serviceType": "sentry_notification",
                "targetDisplay": "default",
                "targeyIdentifier": "default",
                "targetType": "specific",
                "trigger-type": "spike-protection",
                "projects": [
                    project,
                ],
            }
        ],
        status_codes=["201"],
        response_only=True,
    )
]

LIST_NOTIFICATION_ACTIONS = [
    OpenApiExample(
        "List all Notification Actions related to spike protection",
        value=[
            {
                "id": "836501735",
                "organizationId": "62848264",
                "integrationId": "33858462",
                "sentryAppId": "45836251",
                "serviceType": "sentry_notification",
                "targetDisplay": "default",
                "targeyIdentifier": "default",
                "targetType": "specific",
                "triggerType": "spike-protection",
                "projects": [project],
            },
            {
                "id": "73847650",
                "organizationId": "62848264",
                "integrationId": "33858462",
                "sentryAppId": "45836251",
                "serviceType": "sentry_notification",
                "targetDisplay": "default",
                "targeyIdentifier": "default",
                "targetType": "specific",
                "triggerType": "spike-protection",
                "projects": [
                    {
                        "id": "2234153",
                        "slug": "the-spoiled-egg",
                        "name": "The Spoiled Egg",
                        "platform": "",
                        "dateCreated": "2023-06-02T17:50:20.304762Z",
                        "isBookmarked": False,
                        "isMember": False,
                        "features": [
                            "alert-filters",
                            "custom-inbound-filters",
                            "data-forwarding",
                            "discard-groups",
                            "minidump",
                            "race-free-group-creation",
                            "rate-limits",
                            "servicehooks",
                            "similarity-indexing",
                            "similarity-indexing-v2",
                            "similarity-view",
                            "similarity-view-v2",
                        ],
                        "firstEvent": "2023-07-03T18:10:56.197351Z",
                        "firstTransactionEvent": False,
                        "access": [
                            "alerts:read",
                            "event:write",
                            "org:read",
                            "project:read",
                            "member:read",
                            "team:read",
                            "event:read",
                            "project:releases",
                        ],
                        "hasAccess": True,
                        "hasMinifiedStackTrace": False,
                        "hasMonitors": True,
                        "hasProfiles": False,
                        "hasReplays": False,
                        "hasSessions": False,
                        "isInternal": False,
                        "isPublic": False,
                        "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
                        "color": "#6e3fbf",
                        "status": "active",
                    },
                ],
            },
        ],
        status_codes=["201"],
        response_only=True,
    )
]
