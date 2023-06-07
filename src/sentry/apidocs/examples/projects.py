from drf_spectacular.utils import OpenApiExample


class PROJECT_EXAMPLES:
    CREATE_NEW_PROJECT = (
        OpenApiExample(
            "Successful response",
            value={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "id": "102",
                "userName": "test.user@okta.local",
                "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                "name": {"familyName": "N/A", "givenName": "N/A"},
                "active": True,
                "meta": {"resourceType": "User"},
                "sentryOrgRole": "member",
            },
            status_codes=["201"],
        ),
    )
