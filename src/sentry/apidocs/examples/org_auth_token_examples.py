from drf_spectacular.utils import OpenApiExample

ORG_AUTH_TOKEN = {
    "id": "1",
    "name": "CI release uploads",
    "scopes": ["org:ci"],
    "tokenLastCharacters": "Jk4Q",
    "dateCreated": "2024-07-16T15:36:46.048343Z",
    "dateLastUsed": "2024-07-17T09:12:44.104915Z",
    "projectLastUsedId": "2",
}


class OrgAuthTokenExamples:
    LIST_ORG_AUTH_TOKENS = [
        OpenApiExample(
            "List org auth tokens",
            value=[
                ORG_AUTH_TOKEN,
                {
                    **ORG_AUTH_TOKEN,
                    "id": "3",
                    "name": "Unused token",
                    "tokenLastCharacters": "w2Pe",
                    "dateLastUsed": None,
                    "projectLastUsedId": None,
                },
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    CREATE_ORG_AUTH_TOKEN = [
        OpenApiExample(
            "Create an org auth token",
            value={
                **ORG_AUTH_TOKEN,
                "id": "4",
                "dateLastUsed": None,
                "projectLastUsedId": None,
                "token": "sntrys_<base64-payload>_<secret>",
            },
            status_codes=["201"],
            response_only=True,
        )
    ]
