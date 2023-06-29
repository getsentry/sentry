from drf_spectacular.utils import OpenApiExample

key_with_rate_limiting = {
    "id": "60120449b6b1d5e45f75561e6dabd80b",
    "name": "Liked Pegasus",
    "label": "Liked Pegasus",
    "public": "60120449b6b1d5e45f75561e6dabd80b",
    "secret": "189485c3b8ccf582bf5e12c530ef8858",
    "projectId": 4505281256090153,
    "isActive": True,
    "rateLimit": {"window": 7200, "count": 1000},
    "dsn": {
        "secret": "https://a785682ddda742d7a8a4088810e67701:bcd99b3790b3441c85ce4b1eaa854f66@o4504765715316736.ingest.sentry.io/4505281256090153",
        "public": "https://a785682ddda742d7a8a4088810e67791@o4504765715316736.ingest.sentry.io/4505281256090153",
        "csp": "https://o4504765715316736.ingest.sentry.io/api/4505281256090153/csp-report/?sentry_key=a785682ddda719b7a8a4011110d75598",
        "security": "https://o4504765715316736.ingest.sentry.io/api/4505281256090153/security/?sentry_key=a785682ddda719b7a8a4011110d75598",
        "minidump": "https://o4504765715316736.ingest.sentry.io/api/4505281256090153/minidump/?sentry_key=a785682ddda719b7a8a4011110d75598",
        "unreal": "https://o4504765715316736.ingest.sentry.io/api/4505281256090153/unreal/a785682ddda719b7a8a4011110d75598/",
        "cdn": "https://js.sentry-cdn.com/a785682ddda719b7a8a4011110d75598.min.js",
    },
    "browserSdkVersion": "7.x",
    "browserSdk": {"choices": [["latest", "latest"], ["7.x", "7.x"]]},
    "dateCreated": "2023-06-21T19:50:26.036254Z",
    "dynamicSdkLoaderOptions": {
        "hasReplay": True,
        "hasPerformance": True,
        "hasDebug": True,
    },
}

key_wo_rate_limiting = {
    "id": "da8d69cb17e80677b76e08fde4656b93",
    "name": "Bold Oarfish",
    "label": "Bold Oarfish",
    "public": "da8d69cb17e80677b76e08fde4656b93",
    "secret": "5c241ebc42ccfbec281cbefbedc7ab96",
    "projectId": 4505281256090153,
    "isActive": True,
    "rateLimit": None,
    "dsn": {
        "secret": "https://a785682ddda742d7a8a4088810e67701:bcd99b3790b3441c85ce4b1eaa854f66@o4504765715316736.ingest.sentry.io/4505281256090153",
        "public": "https://a785682ddda742d7a8a4088810e67791@o4504765715316736.ingest.sentry.io/4505281256090153",
        "csp": "https://o4504765715316736.ingest.sentry.io/api/4505281256090153/csp-report/?sentry_key=a785682ddda719b7a8a4011110d75598",
        "security": "https://o4504765715316736.ingest.sentry.io/api/4505281256090153/security/?sentry_key=a785682ddda719b7a8a4011110d75598",
        "minidump": "https://o4504765715316736.ingest.sentry.io/api/4505281256090153/minidump/?sentry_key=a785682ddda719b7a8a4011110d75598",
        "unreal": "https://o4504765715316736.ingest.sentry.io/api/4505281256090153/unreal/a785682ddda719b7a8a4011110d75598/",
        "cdn": "https://js.sentry-cdn.com/a785682ddda719b7a8a4011110d75598.min.js",
    },
    "browserSdkVersion": "7.x",
    "browserSdk": {"choices": [["latest", "latest"], ["7.x", "7.x"]]},
    "dateCreated": "2023-06-21T18:17:52.707298Z",
    "dynamicSdkLoaderOptions": {
        "hasReplay": True,
        "hasPerformance": True,
        "hasDebug": False,
    },
}

project = {
    "id": "4505321021243392",
    "slug": "the-spoiled-yoghurt",
    "name": "The Spoiled Yoghurt",
    "platform": "python",
    "dateCreated": "2023-06-08T00:13:06.004534Z",
    "isBookmarked": False,
    "isMember": True,
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
    "firstEvent": None,
    "firstTransactionEvent": False,
    "access": [
        "member:read",
        "event:read",
        "project:admin",
        "team:write",
        "project:write",
        "team:admin",
        "project:read",
        "org:integrations",
        "org:read",
        "project:releases",
        "team:read",
        "alerts:write",
        "event:admin",
        "event:write",
        "alerts:read",
    ],
    "hasAccess": True,
    "hasMinifiedStackTrace": False,
    "hasMonitors": False,
    "hasProfiles": False,
    "hasReplays": False,
    "hasSessions": False,
    "isInternal": False,
    "isPublic": False,
    "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
    "color": "#3f70bf",
    "status": "active",
}


class ProjectExamples:
    BASE_KEY = [
        OpenApiExample(
            "Client key with rate limiting",
            value=key_with_rate_limiting,
            status_codes=["200", "201"],
            response_only=True,
        ),
    ]

    CREATE_PROJECT = [
        OpenApiExample(
            "Project successfully created",
            value=project,
            status_codes=["201"],
            response_only=True,
        ),
    ]

    LIST_CLIENT_KEYS = [
        OpenApiExample(
            "List Client Keys for a Project",
            value=[
                key_with_rate_limiting,
                key_wo_rate_limiting,
            ],
            status_codes=["200"],
            response_only=True,
        ),
    ]

    RETREVE_CLIENT_KEY = [
        OpenApiExample(
            "Retrieve an Existing Client Key",
            value=key_wo_rate_limiting,
            status_codes=["200"],
            response_only=True,
        ),
    ]
