from drf_spectacular.utils import OpenApiExample


class SCIMExamples:
    LIST_ORG_MEMBERS = [
        OpenApiExample(
            "List an Organization's Members",
            value={
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
                "totalResults": 1,
                "startIndex": 1,
                "itemsPerPage": 1,
                "Resources": [
                    {
                        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                        "id": "102",
                        "userName": "test.user@okta.local",
                        "emails": [
                            {"primary": True, "value": "test.user@okta.local", "type": "work"}
                        ],
                        "name": {"familyName": "N/A", "givenName": "N/A"},
                        "active": True,
                        "meta": {"resourceType": "User"},
                        "sentryOrgRole": "member",
                    }
                ],
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]

    LIST_ORG_PAGINATED_TEAMS = [
        OpenApiExample(
            "listGroups",
            value={
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
                "totalResults": 1,
                "startIndex": 1,
                "itemsPerPage": 1,
                "Resources": [
                    {
                        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                        "id": "23232",
                        "displayName": "test-scimv2",
                        "members": [],
                        "meta": {"resourceType": "Group"},
                    }
                ],
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]

    PROVISION_NEW_MEMBER = [
        OpenApiExample(
            "Provision new member",
            response_only=True,
            value={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "id": "242",
                "userName": "test.user@okta.local",
                "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                "active": True,
                "name": {"familyName": "N/A", "givenName": "N/A"},
                "meta": {"resourceType": "User"},
                "sentryOrgRole": "member",
            },
            status_codes=["201"],
        ),
    ]

    PROVISION_NEW_TEAM = [
        OpenApiExample(
            "provisionTeam",
            response_only=True,
            value={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                "displayName": "Test SCIMv2",
                "members": [],
                "meta": {"resourceType": "Group"},
                "id": "123",
            },
            status_codes=["201"],
        ),
    ]

    QUERY_INDIVIDUAL_TEAM = [
        OpenApiExample(
            "Successful response",
            value={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                "id": "23232",
                "displayName": "test-scimv2",
                "members": [],
                "meta": {"resourceType": "Group"},
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]

    QUERY_ORG_MEMBER = [
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
            status_codes=["200"],
            response_only=True,
        ),
    ]

    UPDATE_ORG_MEMBER_ATTRIBUTES = [
        OpenApiExample(
            "Set member inactive",
            value={
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [{"op": "replace", "value": {"active": False}}],
            },
            status_codes=["204"],
            response_only=True,
        ),
    ]

    UPDATE_USER_ROLE = [
        OpenApiExample(
            "Update a user",
            response_only=True,
            value={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "id": "242",
                "userName": "test.user@okta.local",
                "emails": [{"primary": True, "value": "test.user@okta.local", "type": "work"}],
                "active": True,
                "name": {"familyName": "N/A", "givenName": "N/A"},
                "meta": {"resourceType": "User"},
            },
            status_codes=["201"],
        ),
    ]
