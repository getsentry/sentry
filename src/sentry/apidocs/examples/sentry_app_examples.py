from drf_spectacular.utils import OpenApiExample


class SentryAppExamples:
    RETRIEVE_SENTRY_APP = [
        OpenApiExample(
            "Retrieve a custom integration",
            value={
                "allowedOrigins": [],
                "author": "ACME Corp",
                "avatars": [],
                "events": ["issue"],
                "isAlertable": False,
                "metadata": {},
                "name": " ACME Corp Integration",
                "overview": None,
                "popularity": 27,
                "redirectUrl": None,
                "schema": {
                    "elements": [
                        {
                            "type": "alert-rule-action",
                            "required_fields": [
                                {"type": "text", "label": "Channel", "name": "channel"}
                            ],
                        }
                    ]
                },
                "scopes": ["event:read", "org:read"],
                "slug": "acme-corp-integration",
                "status": "unpublished",
                "uuid": "c9c0e35f-6c17-480d-9788-31a7e174bd44",
                "verifyInstall": True,
                "webhookUrl": "https://example.com/webhook",
                "clientId": "ed06141686bb60102d878c607eff449fa9907fa7a8cb70f0d337a8fb0b6566c3",
                "clientSecret": "**********",
                "owner": {"id": 42, "slug": "acme-corp"},
            },
            status_codes=["200"],
            response_only=True,
        )
    ]

    UPDATE_SENTRY_APP = [
        OpenApiExample(
            "Update a custom integration",
            value={
                "allowedOrigins": [],
                "author": "ACME Corp",
                "avatars": [],
                "events": ["issue"],
                "isAlertable": False,
                "metadata": {},
                "name": "ACME Corp Integration",
                "overview": None,
                "popularity": 27,
                "redirectUrl": None,
                "schema": {
                    "elements": [
                        {
                            "type": "alert-rule-action",
                            "required_fields": [
                                {"type": "text", "label": "Channel", "name": "channel"}
                            ],
                        }
                    ]
                },
                "scopes": ["event:read", "org:read"],
                "slug": "acme-corp-integration",
                "status": "unpublished",
                "verifyInstall": True,
                "webhookUrl": "https://example.com/webhook",
                "owner": {"id": 42, "slug": "acme-corp"},
                "clientId": "ed06141686bb60102d878c607eff449fa9907fa7a8cb70f0d337a8fb0b6566c3",
                "clientSecret": "**********",
            },
            status_codes=["200"],
        )
    ]
