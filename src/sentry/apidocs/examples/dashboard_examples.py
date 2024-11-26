from drf_spectacular.utils import OpenApiExample

DASHBOARD_OBJECT = {
    "id": "1",
    "title": "Dashboard",
    "dateCreated": "2024-06-20T14:38:03.498574Z",
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
    "widgets": [
        {
            "id": "658714",
            "title": "Custom Widget",
            "description": None,
            "displayType": "table",
            "thresholds": None,
            "interval": "5m",
            "dateCreated": "2024-07-16T15:36:46.048343Z",
            "dashboardId": "1",
            "datasetSource": "user",
            "queries": [
                {
                    "id": "1",
                    "name": "",
                    "fields": ["avg(transaction.duration)", "transaction"],
                    "aggregates": ["avg(transaction.duration)"],
                    "columns": ["transaction"],
                    "fieldAliases": ["", ""],
                    "conditions": "",
                    "orderby": "-avg(transaction.duration)",
                    "widgetId": "1",
                    "onDemand": [
                        {
                            "enabled": False,
                            "extractionState": "disabled:not-applicable",
                            "dashboardWidgetQueryId": 1,
                        }
                    ],
                    "isHidden": False,
                    "selectedAggregate": None,
                }
            ],
            "limit": None,
            "widgetType": "discover",
            "layout": {"w": 2, "y": 0, "h": 2, "minH": 2, "x": 0},
        }
    ],
    "projects": [1],
    "filters": {},
    "period": "7d",
    "permissions": {
        "isEditableByEveryone": True,
        "teamsWithEditAccess": [],
    },
}

DASHBOARDS_OBJECT = [
    {
        "id": "1",
        "title": "Dashboard",
        "dateCreated": "2024-06-20T14:38:03.498574Z",
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
        "widgetDisplay": [],
        "widgetPreview": [],
        "permissions": {"isEditableByEveryone": True, "teamsWithEditAccess": []},
    },
    {
        "id": "2",
        "title": "Dashboard",
        "dateCreated": "2024-06-20T14:38:03.498574Z",
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
        "widgetDisplay": [],
        "widgetPreview": [],
        "permissions": None,
    },
]


class DashboardExamples:
    DASHBOARD_GET_RESPONSE = [
        OpenApiExample(
            "Dashboard GET response",
            value=DASHBOARD_OBJECT,
            status_codes=["200"],
            response_only=True,
        )
    ]

    DASHBOARD_PUT_RESPONSE = [
        OpenApiExample(
            "Dashboard PUT response",
            value=DASHBOARD_OBJECT,
            status_codes=["200"],
            response_only=True,
        )
    ]

    DASHBOARD_POST_RESPONSE = [
        OpenApiExample(
            "Create Dashboard",
            value=DASHBOARD_OBJECT,
            status_codes=["201"],
            response_only=True,
        )
    ]

    DASHBOARDS_QUERY_RESPONSE = [
        OpenApiExample(
            "Query Dashboards",
            value=DASHBOARDS_OBJECT,
            status_codes=["200"],
            response_only=True,
        )
    ]
