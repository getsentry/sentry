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
            "List an orgs's paginated teams",
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
            "Query individual team",
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
            "Query org member",
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

    SERVICE_PROVIDER_CONFIG = [
        OpenApiExample(
            "Retrieve the service provider configuration",
            value={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
                "documentationUri": "https://docs.sentry.io/organization/authentication/sso/",
                "patch": {"supported": True},
                "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
                "filter": {"supported": True, "maxResults": 100},
                "changePassword": {"supported": False},
                "sort": {"supported": False},
                "etag": {"supported": False},
                "authenticationSchemes": [
                    {
                        "type": "oauthbearertoken",
                        "name": "OAuth Bearer Token",
                        "description": "Authentication scheme using the OAuth Bearer Token standard. Use the SCIM token generated for your organization.",
                        "specUri": "https://www.rfc-editor.org/info/rfc6750",
                        "primary": True,
                    }
                ],
                "meta": {
                    "resourceType": "ServiceProviderConfig",
                    "location": "https://sentry.io/api/0/organizations/example-org/scim/v2/ServiceProviderConfig",
                },
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]

    LIST_RESOURCE_TYPES = [
        OpenApiExample(
            "List the resource types",
            value={
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
                "totalResults": 2,
                "startIndex": 1,
                "itemsPerPage": 2,
                "Resources": [
                    {
                        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
                        "id": "User",
                        "name": "User",
                        "description": "SCIM User maps to Sentry Organization Member",
                        "endpoint": "/Users",
                        "schema": "urn:ietf:params:scim:schemas:core:2.0:User",
                        "meta": {
                            "resourceType": "ResourceType",
                            "location": "https://sentry.io/api/0/organizations/example-org/scim/v2/ResourceTypes/User",
                        },
                    },
                    {
                        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
                        "id": "Group",
                        "name": "Group",
                        "description": "SCIM Group maps to Sentry Team",
                        "endpoint": "/Groups",
                        "schema": "urn:ietf:params:scim:schemas:core:2.0:Group",
                        "meta": {
                            "resourceType": "ResourceType",
                            "location": "https://sentry.io/api/0/organizations/example-org/scim/v2/ResourceTypes/Group",
                        },
                    },
                ],
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]

    RESOURCE_TYPE_DETAILS = [
        OpenApiExample(
            "Query an individual resource type",
            value={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
                "id": "User",
                "name": "User",
                "description": "SCIM User maps to Sentry Organization Member",
                "endpoint": "/Users",
                "schema": "urn:ietf:params:scim:schemas:core:2.0:User",
                "meta": {
                    "resourceType": "ResourceType",
                    "location": "https://sentry.io/api/0/organizations/example-org/scim/v2/ResourceTypes/User",
                },
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]

    SCHEMA_DETAILS = [
        OpenApiExample(
            "Query an individual schema",
            value={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Schema"],
                "id": "urn:ietf:params:scim:schemas:core:2.0:User",
                "name": "User",
                "description": "SCIM User maps to Sentry Organization Member",
                "attributes": [
                    {
                        "name": "userName",
                        "type": "string",
                        "multiValued": False,
                        "description": "Unique identifier for the User, which for Sentry is an email address.",
                        "required": True,
                        "caseExact": False,
                        "mutability": "immutable",
                        "returned": "default",
                        "uniqueness": "server",
                    }
                ],
                "meta": {
                    "resourceType": "Schema",
                    "location": "https://sentry.io/api/0/organizations/example-org/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User",
                },
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]
