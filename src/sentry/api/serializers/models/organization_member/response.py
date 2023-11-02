from datetime import datetime
from typing import List, Optional

from typing_extensions import TypedDict

from sentry.api.serializers.models.external_actor import ExternalActorResponse
from sentry.api.serializers.models.role import (
    OrganizationRoleSerializerResponse,
    TeamRoleSerializerResponse,
)
from sentry.api.serializers.models.user import UserSerializerResponse


class SCIMName(TypedDict):
    givenName: str
    familyName: str


class SCIMEmail(TypedDict):
    primary: bool
    value: str
    type: str


class SCIMMeta(TypedDict):
    resourceType: str


class OrganizationMemberSCIMSerializerOptional(TypedDict, total=False):
    """Sentry doesn't use this field but is expected by SCIM"""

    active: bool


class OrganizationMemberSCIMSerializerResponse(OrganizationMemberSCIMSerializerOptional):
    """
    Conforming to the SCIM RFC, this represents a Sentry Org Member
    as a SCIM user object.
    """

    schemas: List[str]
    id: str
    userName: str
    name: SCIMName
    emails: List[SCIMEmail]
    meta: SCIMMeta
    sentryOrgRole: str


# We must use alternative TypedDict syntax because of dashes/colons in names.
_OrganizationMemberFlags = TypedDict(
    "_OrganizationMemberFlags",
    {
        "idp:provisioned": bool,
        "idp:role-restricted": bool,
        "sso:linked": bool,
        "sso:invalid": bool,
        "member-limit:restricted": bool,
        "partnership:restricted": bool,
    },
)


class _TeamRole(TypedDict):
    teamSlug: str
    role: str


class OrganizationMemberResponseOptional(TypedDict, total=False):
    externalUsers: List[ExternalActorResponse]
    groupOrgRoles: List[OrganizationRoleSerializerResponse]
    role: str  # Deprecated: use orgRole
    roleName: str  # Deprecated


class OrganizationMemberResponse(OrganizationMemberResponseOptional):
    id: str
    email: str
    name: str
    user: UserSerializerResponse
    orgRole: str
    pending: bool
    expired: bool
    flags: _OrganizationMemberFlags
    dateCreated: datetime
    inviteStatus: str
    inviterName: Optional[str]


class OrganizationMemberWithTeamsResponse(OrganizationMemberResponse):
    teams: List[str]
    teamRoles: List[_TeamRole]


class OrganizationMemberWithProjectsResponse(OrganizationMemberResponse):
    projects: List[str]


class OrganizationMemberWithRolesResponseOptional(TypedDict, total=False):
    roles: List[OrganizationRoleSerializerResponse]  # Deprecated: use orgRoleList


class OrganizationMemberWithRolesResponse(
    OrganizationMemberWithTeamsResponse, OrganizationMemberWithRolesResponseOptional
):
    invite_link: Optional[str]
    isOnlyOwner: bool
    orgRoleList: List[OrganizationRoleSerializerResponse]
    teamRoleList: List[TeamRoleSerializerResponse]
