from drf_spectacular.utils import OpenApiExample

EXPLORE_SAVED_QUERY_OBJ = {
    "id": "1",
    "name": "Pageloads",
    "projects": [],
    "dateAdded": "2024-07-25T19:35:38.422859Z",
    "dateUpdated": "2024-07-25T19:35:38.422874Z",
    "environment": [],
    "query": "span.op:pageload",
    "fields": [
        "span.op",
        "project",
        "count(span.duration)",
        "avg(span.duration)",
        "p75(span.duration)",
        "p95(span.duration)",
    ],
    "range": "24h",
    "orderby": "-count(span.duration)",
    "mode": "samples",
    "dataset": "spans",
    "expired": False,
    "createdBy": {
        "id": "1",
        "name": "Admin",
        "username": "admin",
        "email": "admin@sentry.io",
        "avatarUrl": "www.example.com",
        "isActive": True,
        "hasPasswordAuth": True,
        "isManaged": False,
        "dateJoined": "2021-10-25T17:07:33.190596Z",
        "lastLogin": "2024-07-16T15:28:39.261659Z",
        "has2fa": True,
        "lastActive": "2024-07-16T20:45:49.364197Z",
        "isSuperuser": False,
        "isStaff": False,
        "experiments": {},
        "emails": [{"id": "1", "email": "admin@sentry.io", "is_verified": True}],
        "avatar": {
            "avatarType": "letter_avatar",
            "avatarUuid": None,
            "avatarUrl": "www.example.com",
        },
    },
}

SAVED_QUERIES = [
    {
        "id": "1",
        "name": "Pageloads",
        "projects": [],
        "dateAdded": "2024-07-25T19:35:38.422859Z",
        "dateUpdated": "2024-07-25T19:35:38.422874Z",
        "environment": [],
        "query": "span.op:pageload",
        "fields": [
            "span.op",
            "timestamp",
        ],
        "range": "24h",
        "orderby": "-timestamp",
        "mode": "samples",
        "dataset": "spans",
        "expired": False,
        "createdBy": {
            "id": "1",
            "name": "Admin",
            "username": "admin",
            "email": "admin@sentry.io",
            "avatarUrl": "www.example.com",
            "isActive": True,
            "hasPasswordAuth": True,
            "isManaged": False,
            "dateJoined": "2021-10-25T17:07:33.190596Z",
            "lastLogin": "2024-07-16T15:28:39.261659Z",
            "has2fa": True,
            "lastActive": "2024-07-16T20:45:49.364197Z",
            "isSuperuser": False,
            "isStaff": False,
            "experiments": {},
            "emails": [{"id": "1", "email": "admin@sentry.io", "is_verified": True}],
            "avatar": {
                "avatarType": "letter_avatar",
                "avatarUuid": None,
                "avatarUrl": "www.example.com",
            },
        },
    },
    {
        "id": "2",
        "name": "Cache Gets",
        "projects": [],
        "dateAdded": "2024-07-25T19:35:38.422859Z",
        "dateUpdated": "2024-07-25T19:35:38.422874Z",
        "environment": [],
        "query": "span.op:cache.get",
        "fields": [
            "span.op",
            "span.duration",
            "timestamp",
        ],
        "range": "24h",
        "orderby": "-timestamp",
        "mode": "samples",
        "dataset": "spans",
        "expired": False,
        "createdBy": {
            "id": "1",
            "name": "Admin",
            "username": "admin",
            "email": "admin@sentry.io",
            "avatarUrl": "www.example.com",
            "isActive": True,
            "hasPasswordAuth": True,
            "isManaged": False,
            "dateJoined": "2021-10-25T17:07:33.190596Z",
            "lastLogin": "2024-07-16T15:28:39.261659Z",
            "has2fa": True,
            "lastActive": "2024-07-16T20:45:49.364197Z",
            "isSuperuser": False,
            "isStaff": False,
            "experiments": {},
            "emails": [{"id": "1", "email": "admin@sentry.io", "is_verified": True}],
            "avatar": {
                "avatarType": "letter_avatar",
                "avatarUuid": None,
                "avatarUrl": "www.example.com",
            },
        },
    },
]


class ExploreExamples:
    EXPLORE_SAVED_QUERY_GET_RESPONSE = [
        OpenApiExample(
            "Explore Saved Query GET response",
            value=EXPLORE_SAVED_QUERY_OBJ,
            status_codes=["200"],
            response_only=True,
        )
    ]

    EXPLORE_SAVED_QUERY_POST_RESPONSE = [
        OpenApiExample(
            "Create Explore Saved Query",
            value=EXPLORE_SAVED_QUERY_OBJ,
            status_codes=["201"],
            response_only=True,
        )
    ]

    EXPLORE_SAVED_QUERIES_QUERY_RESPONSE = [
        OpenApiExample(
            "Get Explore Saved Queries",
            value=SAVED_QUERIES,
            status_codes=["200"],
            response_only=True,
        )
    ]
