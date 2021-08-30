from enum import Enum

SCIM_API_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
SCIM_SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User"
SCIM_SCHEMA_GROUP = "urn:ietf:params:scim:schemas:core:2.0:Group"
ERR_ONLY_OWNER = "You cannot remove the only remaining owner of the organization."

SCIM_API_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error"
SCIM_API_PATCH = "urn:ietf:params:scim:api:messages:2.0:PatchOp"
SCIM_COUNT = 100

SCIM_404_USER_RES = {
    "schemas": [SCIM_API_ERROR],
    "detail": "User not found.",
}

SCIM_404_GROUP_RES = {
    "schemas": [SCIM_API_ERROR],
    "detail": "Group not found.",
}

SCIM_409_USER_EXISTS = {
    "schemas": [SCIM_API_ERROR],
    "detail": "User already exists in the database.",
}
SCIM_400_INVALID_FILTER = {
    "schemas": [SCIM_API_ERROR],
    "scimType": "invalidFilter",
}

SCIM_400_INTEGRITY_ERROR = {
    "schemas": [SCIM_API_ERROR],
    "detail": "Database Integrity Error.",
}

SCIM_400_TOO_MANY_PATCH_OPS_ERROR = {
    "schemas": [SCIM_API_ERROR],
    "detail": "Too many patch ops sent, limit is 100.",
}

SCIM_400_UNSUPPORTED_ATTRIBUTE = {
    "schemas": [SCIM_API_ERROR],
    "detail": "Invalid Replace attr. Only displayName and members supported.",
}

SCIM_400_INVALID_PATCH = {
    "schemas": [SCIM_API_ERROR],
    "detail": "Invalid Patch Operation.",
}


class TeamPatchOps(str, Enum):
    ADD = "add"
    REMOVE = "remove"
    REPLACE = "replace"


class MemberPatchOps(str, Enum):
    REPLACE = "replace"
