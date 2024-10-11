from drf_spectacular.utils import OpenApiExample


class IntegrationExamples:
    LIST_INTEGRATIONS = [
        OpenApiExample(
            "List All Available Integrations for Alphabet Soup Factory",
            value=[
                {
                    "id": "24817",
                    "name": "Alphabet Soup Factory",
                    "icon": "https://avatars.slack-edge.com/alphabet-soup",
                    "domainName": "alphabet-soup.slack.com",
                    "accountType": None,
                    "scopes": [
                        "channels:read",
                        "chat:write",
                        "chat:write.customize",
                        "chat:write.public",
                        "commands",
                        "groups:read",
                        "im:history",
                        "im:read",
                        "links:read",
                        "links:write",
                        "team:read",
                        "users:read",
                    ],
                    "status": "active",
                    "provider": {
                        "key": "slack",
                        "slug": "slack",
                        "name": "Slack",
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["alert-rule", "chat-unfurl"],
                        "aspects": {
                            "alerts": [
                                {
                                    "type": "info",
                                    "text": "The Slack integration adds a new Alert Rule action to all projects. To enable automatic notifications sent to Slack you must create a rule using the slack workspace action in your project settings.",
                                }
                            ]
                        },
                    },
                    "configOrganization": [],
                    "configData": {"installationType": "born_as_bot"},
                    "externalId": "7252394",
                    "organizationId": 6234528,
                    "organizationIntegrationStatus": "active",
                    "gracePeriodEnd": None,
                }
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    EXTERNAL_USER_CREATE = [
        OpenApiExample(
            "Create an external user",
            value={
                "externalName": "@Billybob",
                "provider": "github",
                "userId": "1",
                "integrationId": "1",
                "id": "1",
            },
            status_codes=["200", "201"],
            response_only=True,
        )
    ]

    EXTERNAL_TEAM_CREATE = [
        OpenApiExample(
            "Create an external team",
            value={
                "externalId": "asdf",
                "externalName": "@team-foo",
                "provider": "slack",
                "integrationId": "1",
                "id": "1",
                "teamId": "2",
            },
            status_codes=["200", "201"],
            response_only=True,
        )
    ]
