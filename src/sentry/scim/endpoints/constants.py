SCIM_API_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
SCIM_SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User"
ERR_ONLY_OWNER = "You cannot remove the only remaining owner of the organization."
SCIM_API_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error"
SCIM_API_PATCH = "urn:ietf:params:scim:api:messages:2.0:PatchOp"
SCIM_COUNT = 100

SCIM_404_USER_RES = {
    "schemas": [SCIM_API_ERROR],
    "detail": "User not found.",
}

SCIM_409_USER_EXISTS = {
    "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
    "detail": "User already exists in the database.",
}
