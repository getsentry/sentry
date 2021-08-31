from rest_framework.response import Response

from .constants import SCIM_SCHEMA_GROUP, SCIM_SCHEMA_USER
from .utils import SCIMEndpoint

SCIM_USER_ATTRIBUTES_SCHEMA = {
    "id": SCIM_SCHEMA_USER,
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
            "mutability": "read",
            "returned": "default",
            "uniqueness": "server",
        },
        {
            "name": "emails",
            "type": "complex",
            "multiValued": True,
            "description": "Email addresses for the user. Canonical type values of 'work', 'home', and 'other'.",
            "required": False,
            "subAttributes": [
                {
                    "name": "value",
                    "type": "string",
                    "multiValued": False,
                    "description": "Email addresses for the user.  The value is canonicalized to be lowercase.",
                    "required": False,
                    "caseExact": False,
                    "mutability": "read",
                    "returned": "default",
                    "uniqueness": "none",
                },
                {
                    "name": "display",
                    "type": "string",
                    "multiValued": False,
                    "description": "A human-readable name, primarily used for display purposes.  READ-ONLY.",
                    "required": False,
                    "caseExact": False,
                    "mutability": "read",
                    "returned": "default",
                    "uniqueness": "none",
                },
                {
                    "name": "type",
                    "type": "string",
                    "multiValued": False,
                    "description": "A label indicating the attribute's function, e.g., 'work' or 'home'.",
                    "required": False,
                    "caseExact": False,
                    "canonicalValues": ["work", "home", "other"],
                    "mutability": "read",
                    "returned": "default",
                    "uniqueness": "none",
                },
                {
                    "name": "primary",
                    "type": "boolean",
                    "multiValued": False,
                    "description": "A Boolean value indicating the 'primary' or preferred attribute value for this attribute. The primary attribute value 'true' MUST appear no more than once.",
                    "required": False,
                    "mutability": "read",
                    "returned": "default",
                },
            ],
            "mutability": "read",
            "returned": "default",
            "uniqueness": "none",
        },
        {
            "name": "active",
            "type": "boolean",
            "multiValued": False,
            "description": "A Boolean value indicating the User's administrative status.",
            "required": False,
            "mutability": "readWrite",
            "returned": "default",
        },
        {
            "name": "name",
            "type": "complex",
            "multiValued": False,
            "description": "Sentry does not support the name attribute but returns it for compatibility purposes.",
            "required": False,
            "subAttributes": [
                {
                    "name": "familyName",
                    "type": "string",
                    "multiValued": False,
                    "description": "The family name of the User, Sentry does not support this attribute and will return N/A as a string for compatibility purposes.",
                    "required": False,
                    "caseExact": False,
                    "mutability": "readWrite",
                    "returned": "default",
                    "uniqueness": "none",
                },
                {
                    "name": "givenName",
                    "type": "string",
                    "multiValued": False,
                    "description": "The given name of the User, Sentry does not support this attribute and will return N/A as a string for compatibility purposes.",
                    "required": False,
                    "caseExact": False,
                    "mutability": "readWrite",
                    "returned": "default",
                    "uniqueness": "none",
                },
            ],
        },
    ],
    "meta": {
        "resourceType": "Schema",
        "location": "/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User",
    },
}

SCIM_GROUP_ATTRIBUTES_SCHEMA = {
    "id": SCIM_SCHEMA_GROUP,
    "name": "Group",
    "description": "SCIM Group maps to Sentry Team",
    "attributes": [
        {
            "name": "displayName",
            "type": "string",
            "multiValued": False,
            "description": "A human-readable name for the Group. REQUIRED.",
            "required": False,
            "caseExact": False,
            "mutability": "readWrite",
            "returned": "default",
            "uniqueness": "server",
        },
        {
            "name": "members",
            "type": "complex",
            "multiValued": True,
            "description": "A list of members of the Group.",
            "required": False,
            "subAttributes": [
                {
                    "name": "value",
                    "type": "string",
                    "multiValued": False,
                    "description": "Identifier of the member of this Group.",
                    "required": False,
                    "caseExact": False,
                    "mutability": "immutable",
                    "returned": "default",
                    "uniqueness": "none",
                },
                {
                    "name": "$ref",
                    "type": "reference",
                    "referenceTypes": ["User"],
                    "multiValued": False,
                    "description": "The URI of the corresponding 'User' resource to which the user belongs.",
                    "required": False,
                    "caseExact": False,
                    "mutability": "readOnly",
                    "returned": "default",
                    "uniqueness": "none",
                },
            ],
            "mutability": "readWrite",
            "returned": "default",
        },
    ],
    "meta": {
        "resourceType": "Schema",
        "location": "/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group",
    },
}

SCIM_SCHEMA_LIST = [SCIM_USER_ATTRIBUTES_SCHEMA, SCIM_GROUP_ATTRIBUTES_SCHEMA]


class OrganizationSCIMSchemaIndex(SCIMEndpoint):
    def get(self, request, organization):
        query_params = self.get_query_parameters(request)

        return Response(
            self.list_api_format(
                SCIM_SCHEMA_LIST, len(SCIM_SCHEMA_LIST), query_params["start_index"]
            )
        )
