from enum import StrEnum


class ClientFeature(StrEnum):
    CREATE_ORGANIZATION = "organizations:create"
    REGISTER = "auth:register"
    RELOCATION = "relocation:enabled"
    MULTI_REGION = "system:multi-region"


# Serializers expose these capabilities independently of the feature registry.
class OrganizationCapability(StrEnum):
    API_KEYS = "api-keys"
    OPEN_MEMBERSHIP = "open-membership"
    SHARED_ISSUES = "shared-issues"


class ProjectCapability(StrEnum):
    RELEASES = "releases"
