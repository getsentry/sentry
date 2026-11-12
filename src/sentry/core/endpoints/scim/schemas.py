from typing import Annotated, Literal, NotRequired, TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.examples.scim_examples import SCIMExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.utils.http import absolute_uri

from .constants import SCIM_SCHEMA_GROUP, SCIM_SCHEMA_SCHEMA, SCIM_SCHEMA_USER
from .utils import SCIMApiError, SCIMDiscoveryEndpoint, SCIMMetaResponse

# Values defined by RFC 7643, section 7.
SCIMAttributeType = Literal[
    "string", "boolean", "decimal", "integer", "dateTime", "reference", "complex", "binary"
]
SCIMAttributeMutability = Literal["readOnly", "readWrite", "immutable", "writeOnly"]
SCIMAttributeReturned = Literal["always", "never", "default", "request"]
SCIMAttributeUniqueness = Literal["none", "server", "global"]


class SCIMSubAttributeResponse(TypedDict):
    name: Annotated[str, ApiDescription("Name of the attribute")]
    type: Annotated[SCIMAttributeType, ApiDescription("Data type of the attribute")]
    multiValued: Annotated[bool, ApiDescription("Whether the attribute holds a list of values")]
    description: Annotated[str, ApiDescription("What the attribute holds")]
    required: Annotated[bool, ApiDescription("Whether the attribute is required")]
    caseExact: NotRequired[
        Annotated[bool, ApiDescription("Whether string values are compared case-sensitively")]
    ]
    canonicalValues: NotRequired[
        Annotated[list[str], ApiDescription("Values the attribute is expected to take")]
    ]
    mutability: Annotated[
        SCIMAttributeMutability, ApiDescription("Whether and when the attribute can be changed")
    ]
    returned: Annotated[
        SCIMAttributeReturned, ApiDescription("When the attribute is returned in a response")
    ]
    uniqueness: NotRequired[
        Annotated[SCIMAttributeUniqueness, ApiDescription("Scope in which values are unique")]
    ]


class SCIMAttributeResponse(SCIMSubAttributeResponse):
    subAttributes: NotRequired[
        Annotated[
            list[SCIMSubAttributeResponse],
            ApiDescription("Attributes of a complex attribute"),
        ]
    ]


class SCIMSchemaDefinition(TypedDict):
    id: str
    name: str
    description: str
    attributes: list[SCIMAttributeResponse]


SCIM_USER_ATTRIBUTES_SCHEMA: SCIMSchemaDefinition = {
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
            # Consumed only at create (it becomes the member's email); Sentry
            # does not support renames. Not readOnly: Entra excludes readOnly
            # attributes from provisioning payloads entirely and cannot
            # create users without sending userName.
            "mutability": "immutable",
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
                    "mutability": "readOnly",
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
                    "mutability": "readOnly",
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
                    "mutability": "readOnly",
                    "returned": "default",
                    "uniqueness": "none",
                },
                {
                    "name": "primary",
                    "type": "boolean",
                    "multiValued": False,
                    "description": "A Boolean value indicating the 'primary' or preferred attribute value for this attribute. The primary attribute value 'true' MUST appear no more than once.",
                    "required": False,
                    "mutability": "readOnly",
                    "returned": "default",
                },
            ],
            # Derived from userName; values sent by clients are ignored.
            "mutability": "readOnly",
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
                    "mutability": "readOnly",
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
                    "mutability": "readOnly",
                    "returned": "default",
                    "uniqueness": "none",
                },
            ],
            # RFC 7643 §2.2 defaults these when omitted, but Entra's SCIM
            # validator requires mutability to be present on every attribute.
            "mutability": "readOnly",
            "returned": "default",
            "uniqueness": "none",
        },
    ],
}

SCIM_GROUP_ATTRIBUTES_SCHEMA: SCIMSchemaDefinition = {
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
                    "name": "display",
                    "type": "string",
                    "multiValued": False,
                    "description": "A human-readable name for the member, which for Sentry is the member's email address.",
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
}

SCIM_SCHEMA_LIST = [SCIM_USER_ATTRIBUTES_SCHEMA, SCIM_GROUP_ATTRIBUTES_SCHEMA]

SCIM_SCHEMAS_BY_ID = {schema["id"]: schema for schema in SCIM_SCHEMA_LIST}


class SCIMSchemaResponse(TypedDict):
    schemas: Annotated[
        list[str], ApiDescription("SCIM schema URIs of the response, always the Schema schema")
    ]
    id: Annotated[str, ApiDescription("URI of the schema")]
    name: Annotated[str, ApiDescription("Name of the schema: User or Group")]
    description: Annotated[str, ApiDescription("What the schema's resources map to in Sentry")]
    attributes: Annotated[
        list[SCIMAttributeResponse],
        ApiDescription("Attributes of the schema, as SCIM attribute definitions"),
    ]
    meta: Annotated[SCIMMetaResponse, ApiDescription("Resource type and location of the schema")]


def build_schema_representation(
    organization: Organization, schema: SCIMSchemaDefinition
) -> SCIMSchemaResponse:
    return {
        "schemas": [SCIM_SCHEMA_SCHEMA],
        "id": schema["id"],
        "name": schema["name"],
        "description": schema["description"],
        "attributes": schema["attributes"],
        "meta": {
            "resourceType": "Schema",
            "location": absolute_uri(
                f"api/0/organizations/{organization.slug}/scim/v2/Schemas/{schema['id']}"
            ),
        },
    }


@cell_silo_endpoint
class OrganizationSCIMSchemaIndex(SCIMDiscoveryEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        self.reject_filter_param(request)
        # RFC 7644 §4: pagination parameters are ignored on discovery
        # endpoints; all schemas are always returned.
        schemas = [build_schema_representation(organization, s) for s in SCIM_SCHEMA_LIST]
        return Response(self.list_api_format(schemas, len(schemas), 1))


@cell_silo_endpoint
class OrganizationSCIMSchemaDetails(SCIMDiscoveryEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="getOrganizationScimV2Schema",
        summary="Query an Individual SCIM Schema",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="schema_uri",
                location="path",
                required=True,
                type=str,
                description="The SCIM schema URI, e.g. `urn:ietf:params:scim:schemas:core:2.0:User`.",
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("SCIMSchemaResponse", SCIMSchemaResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.SCHEMA_DETAILS,
    )
    def get(
        self, request: Request, organization: Organization, schema_uri: str
    ) -> Response[SCIMSchemaResponse]:
        """
        Return a single SCIM schema definition by its URI. Sentry supports the
        core User and Group schemas.
        """
        self.reject_filter_param(request)
        schema = SCIM_SCHEMAS_BY_ID.get(schema_uri)
        if schema is None:
            raise SCIMApiError(detail="Schema not found.", status_code=404)
        return Response(build_schema_representation(organization, schema))
