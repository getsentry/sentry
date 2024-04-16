from datetime import datetime
from typing import TypedDict


class SerializedAvatarFields(TypedDict, total=False):
    avatarType: str
    avatarUuid: str | None
    avatarUrl: str | None


class _Status(TypedDict):
    id: str
    name: str


class _Links(TypedDict):
    organizationUrl: str
    regionUrl: str


# Moved from serializers/models/organization.py to avoid a circular import between project and
# organization serializers
class OrganizationSerializerResponse(TypedDict):
    id: str
    slug: str
    status: _Status
    name: str
    dateCreated: datetime
    isEarlyAdopter: bool
    require2FA: bool
    requireEmailVerification: bool
    avatar: SerializedAvatarFields
    features: list[str]
    links: _Links
    hasAuthProvider: bool
