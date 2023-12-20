from drf_spectacular.utils import OpenApiExample

GET_PROJECT_OWNERSHIP = [
    OpenApiExample(
        "Get ownership configuration for a project",
        value={
            "raw": "path:src/views/checkout jane.smith@org.com \nurl:https://example.com/checkout jane.smith@org.com\ntags.transaction:/checkout/:page jane.smith@org.com",
            "fallthrough": True,
            "dateCreated": "2023-10-03T20:25:18.539823Z",
            "lastUpdated": "2023-10-03T22:49:12.294741Z",
            "isActive": True,
            "autoAssignment": "Auto Assign to Issue Owner",
            "codeownersAutoSync": True,
            "schema": {
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"type": "path", "pattern": "src/views/checkout"},
                        "owners": [{"type": "user", "id": 2621754, "name": "jane.smith@org.com"}],
                    },
                    {
                        "matcher": {"type": "url", "pattern": "https://example.com/checkout"},
                        "owners": [{"type": "user", "id": 2621754, "name": "jane.smith@org.com"}],
                    },
                    {
                        "matcher": {"type": "tags.transaction", "pattern": "/checkout/:page"},
                        "owners": [{"type": "user", "id": 2621754, "name": "jane.smith@org.com"}],
                    },
                ],
            },
        },
        status_codes=["200"],
        response_only=True,
    )
]

UPDATE_PROJECT_OWNERSHIP = [
    OpenApiExample(
        "Update ownership configuration for a project",
        value={
            "raw": "path:src/views/checkout jane.smith@org.com \nurl:https://example.com/checkout jane.smith@org.com\ntags.transaction:/checkout/:page jane.smith@org.com",
            "fallthrough": True,
            "dateCreated": "2023-10-03T20:25:18.539823Z",
            "lastUpdated": "2023-10-03T22:49:12.294741Z",
            "isActive": True,
            "autoAssignment": "Auto Assign to Issue Owner",
            "codeownersAutoSync": True,
            "schema": {
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"type": "path", "pattern": "src/views/checkout"},
                        "owners": [{"type": "user", "id": 2621754, "name": "jane.smith@org.com"}],
                    },
                    {
                        "matcher": {"type": "url", "pattern": "https://example.com/checkout"},
                        "owners": [{"type": "user", "id": 2621754, "name": "jane.smith@org.com"}],
                    },
                    {
                        "matcher": {"type": "tags.transaction", "pattern": "/checkout/:page"},
                        "owners": [{"type": "user", "id": 2621754, "name": "jane.smith@org.com"}],
                    },
                ],
            },
        },
        status_codes=["202"],
        response_only=True,
    )
]
