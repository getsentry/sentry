from drf_spectacular.utils import OpenApiExample


class SentryAppExamples:
    RETRIEVE_SENTRY_APP = [
        OpenApiExample(
            "Retrieve a custom integration",
            value={
                "allowedOrigins": [],
                "author": "ACME Corp",
                "avatars": [
                    {
                        "avatarType": "avatar",
                        "avatarUuid": "6c25b771-a576-4c18-a1c3-ab059c1d42ba",
                        "avatarUrl": "https://example.com/avatar.png",
                        "color": False,
                        "photoType": "icon",
                    }
                ],
                "events": ["issue"],
                "isAlertable": False,
                "metadata": "",
                "name": "ACME Corp Integration",
                "overview": None,
                "popularity": 27,
                "redirectUrl": None,
                "featureData": [],
                "schema": "",
                "scopes": ["event:read", "org:read"],
                "slug": "acme-corp-integration",
                "status": "unpublished",
                "uuid": "77cebea3-019e-484d-8673-6c3969698827",
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
                "avatars": [
                    {
                        "avatarType": "avatar",
                        "avatarUuid": "6c25b771-a576-4c18-a1c3-ab059c1d42ba",
                        "avatarUrl": "https://example.com/avatar.png",
                        "color": False,
                        "photoType": "icon",
                    }
                ],
                "events": ["issue"],
                "isAlertable": False,
                "metadata": "",
                "name": "ACME Corp Integration",
                "overview": None,
                "popularity": 27,
                "redirectUrl": None,
                "featureData": [],
                "schema": "",
                "scopes": ["event:read", "org:read"],
                "slug": "acme-corp-integration",
                "status": "unpublished",
                "uuid": "77cebea3-019e-484d-8673-6c3969698827",
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

    GET_PLATFORM_EXTERNAL_ISSUE = [
        OpenApiExample(
            "Retrieve the custom integrations associated with an issue id",
            value=[
                {
                    "id": "123456",
                    "issueId": "1234567890",
                    "serviceType": "example-app",
                    "displayName": "example-issue#2",
                    "webUrl": "https://example.com/my-test-project/issue/example-issue-2/this-is-an-example-python-exception",
                }
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_ORGANIZATIONS_SENTRY_APPS = [
        OpenApiExample(
            "Retrieve the custom integrations created by the given organization",
            value=[
                {
                    "allowedOrigins": [],
                    "author": "ACME Corp",
                    "avatars": [
                        {
                            "avatarType": "avatar",
                            "avatarUuid": "6c25b771-a576-4c18-a1c3-ab059c1d42ba",
                            "avatarUrl": "https://example.com/avatar.png",
                            "color": False,
                            "photoType": "icon",
                        }
                    ],
                    "events": ["issue"],
                    "isAlertable": False,
                    "metadata": "",
                    "name": "ACME Corp Integration",
                    "overview": None,
                    "popularity": 27,
                    "redirectUrl": None,
                    "featureData": [],
                    "schema": "",
                    "scopes": ["event:read", "org:read"],
                    "slug": "acme-corp-integration",
                    "status": "unpublished",
                    "uuid": "77cebea3-019e-484d-8673-6c3969698827",
                    "verifyInstall": True,
                    "webhookUrl": "https://example.com/webhook",
                    "clientId": "ed06141686bb60102d878c607eff449fa9907fa7a8cb70f0d337a8fb0b6566c3",
                    "clientSecret": "**********",
                    "owner": {"id": 42, "slug": "acme-corp"},
                },
                {
                    "allowedOrigins": [],
                    "author": "ACME Corp",
                    "avatars": [],
                    "events": ["issue", "event"],
                    "isAlertable": False,
                    "metadata": "",
                    "name": "ACME Corp Integration v2",
                    "overview": None,
                    "popularity": 0,
                    "redirectUrl": "example.com",
                    "featureData": [],
                    "schema": "",
                    "scopes": ["event:admin", "org:admin"],
                    "slug": "acme-corp-integration-v2",
                    "status": "unpublished",
                    "uuid": "77cebea3-019e-484d-8673-123124234",
                    "verifyInstall": True,
                    "webhookUrl": "https://example.com/webhook",
                    "clientId": "2730a92919437a7b052e6827cd2c9f119be37101asdasdad123131231231231",
                    "clientSecret": "**********",
                    "owner": {"id": 42, "slug": "acme-corp"},
                },
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]
