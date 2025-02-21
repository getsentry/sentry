from drf_spectacular.utils import OpenApiExample

DISCOVER_SAVED_QUERY_OBJ = {
    "id": "1",
    "name": "Transactions by Volume",
    "projects": [],
    "version": 2,
    "queryDataset": "transaction-like",
    "datasetSource": "unknown",
    "expired": False,
    "dateCreated": "2024-07-25T19:35:38.422859Z",
    "dateUpdated": "2024-07-25T19:35:38.422874Z",
    "environment": [],
    "query": "transaction:/api/foo",
    "fields": ["transaction", "project", "count()", "avg(transaction.duration)", "p75()", "p95()"],
    "widths": [],
    "range": "24h",
    "orderby": "-count",
    "yAxis": ["count()"],
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
        "name": "Transactions by Volume",
        "projects": [],
        "version": 2,
        "queryDataset": "transaction-like",
        "datasetSource": "unknown",
        "expired": False,
        "dateCreated": "2024-07-25T19:35:38.422859Z",
        "dateUpdated": "2024-07-25T19:35:38.422874Z",
        "environment": [],
        "query": "",
        "fields": [
            "id",
            "transaction",
            "timestamp",
        ],
        "widths": [],
        "range": "24h",
        "orderby": "-timestamp",
        "yAxis": ["count()"],
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
        "name": "All Events",
        "projects": [],
        "version": 2,
        "queryDataset": "transaction-like",
        "datasetSource": "unknown",
        "expired": False,
        "dateCreated": "2024-07-25T19:35:38.422859Z",
        "dateUpdated": "2024-07-25T19:35:38.422874Z",
        "environment": [],
        "query": "transaction:/api/foo",
        "fields": [
            "transaction",
            "project",
            "count()",
            "avg(transaction.duration)",
            "p75()",
            "p95()",
        ],
        "widths": [],
        "range": "24h",
        "orderby": "-count",
        "yAxis": ["count()"],
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


class DiscoverExamples:
    DISCOVER_SAVED_QUERY_GET_RESPONSE = [
        OpenApiExample(
            "Discover Saved Query GET response",
            value=DISCOVER_SAVED_QUERY_OBJ,
            status_codes=["200"],
            response_only=True,
        )
    ]

    DISCOVER_SAVED_QUERY_POST_RESPONSE = [
        OpenApiExample(
            "Create Discover Saved Query",
            value=DISCOVER_SAVED_QUERY_OBJ,
            status_codes=["201"],
            response_only=True,
        )
    ]

    DISCOVER_SAVED_QUERIES_QUERY_RESPONSE = [
        OpenApiExample(
            "Get Discover Saved Queries",
            value=SAVED_QUERIES,
            status_codes=["200"],
            response_only=True,
        )
    ]
