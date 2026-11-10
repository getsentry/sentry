from datetime import datetime
from typing import Annotated, NotRequired, TypedDict

from sentry.api.serializers.models.role import (
    OrganizationRoleSerializerResponse,
    TeamRoleSerializerResponse,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.omissions import sentry_schema_serializer
from sentry.integrations.api.serializers.models.external_actor import ExternalActorResponse
from sentry.models.organizationmember import InviteStatusName
from sentry.users.api.serializers.user import UserSerializerResponse


class SCIMName(TypedDict):
    givenName: Annotated[
        str, ApiDescription("Given name. Always N/A, because Sentry doesn't store it")
    ]
    familyName: Annotated[
        str, ApiDescription("Family name. Always N/A, because Sentry doesn't store it")
    ]


class SCIMEmail(TypedDict):
    primary: Annotated[
        bool, ApiDescription("Whether this is the primary email address. Always true")
    ]
    value: Annotated[str, ApiDescription("Email address")]
    type: Annotated[str, ApiDescription("Email type. Always work")]


class SCIMMeta(TypedDict):
    resourceType: Annotated[str, ApiDescription("SCIM resource type, such as User or Group")]


class OrganizationMemberSCIMSerializerOptional(TypedDict, total=False):
    """Sentry doesn't use this field but is expected by SCIM"""

    active: Annotated[
        bool,
        ApiDescription(
            "Always true when included. Sentry doesn't use this field, but SCIM expects it"
        ),
    ]


class OrganizationMemberSCIMSerializerResponse(OrganizationMemberSCIMSerializerOptional):
    """
    Conforming to the SCIM RFC, this represents a Sentry Org Member
    as a SCIM user object.
    """

    schemas: Annotated[list[str], ApiDescription("SCIM schema URIs of the resource")]
    id: Annotated[str, ApiDescription("Organization member ID")]
    userName: Annotated[str, ApiDescription("Email address of the member")]
    name: Annotated[SCIMName, ApiDescription("Name of the member")]
    emails: Annotated[list[SCIMEmail], ApiDescription("Email addresses of the member")]
    meta: Annotated[SCIMMeta, ApiDescription("SCIM resource metadata")]
    sentryOrgRole: Annotated[str, ApiDescription("ID of the member's organization role")]


# We must use alternative TypedDict syntax because of dashes/colons in names.
_OrganizationMemberFlags = TypedDict(
    "_OrganizationMemberFlags",
    {
        "idp:provisioned": Annotated[
            bool,
            ApiDescription(
                "Whether the member is provisioned and managed through the organization's identity provider (SCIM)"
            ),
        ],
        "idp:role-restricted": Annotated[
            bool,
            ApiDescription(
                "Whether the member's organization role is set by the identity provider through SCIM"
            ),
        ],
        "sso:linked": Annotated[
            bool,
            ApiDescription(
                "Whether the member has linked their account to the organization's SSO provider"
            ),
        ],
        "sso:invalid": Annotated[
            bool,
            ApiDescription("Whether the member's SSO link is invalid"),
        ],
        "member-limit:restricted": Annotated[
            bool,
            ApiDescription("Whether the member is restricted by the plan's member limit"),
        ],
        "partnership:restricted": Annotated[
            bool,
            ApiDescription(
                "Whether the member is managed by an active partnership and can't be changed until it ends"
            ),
        ],
    },
)


class _TeamRole(TypedDict):
    teamSlug: Annotated[str, ApiDescription("Team slug")]
    role: Annotated[
        str | None,
        ApiDescription(
            "ID of the member's team role, or null if the member has the minimum team role from their organization role"
        ),
    ]


@sentry_schema_serializer(
    omit_from_public_schema={
        "role": "Deprecated, use orgRole.",
        "roleName": "Deprecated, derived from orgRole.",
    }
)
class OrganizationMemberResponse(TypedDict):
    externalUsers: NotRequired[
        Annotated[
            list[ExternalActorResponse],
            ApiDescription(
                "Users in external providers, such as Slack or GitHub, linked to the member's user. Included only when requested"
            ),
        ]
    ]
    role: NotRequired[Annotated[str, ApiDescription("Deprecated. Use orgRole")]]
    roleName: NotRequired[
        Annotated[str, ApiDescription("Deprecated. Name of the member's organization role")]
    ]
    id: Annotated[str, ApiDescription("Organization member ID")]
    email: Annotated[
        str,
        ApiDescription(
            "Email address of the member's user, or the invited email address if they have no account yet"
        ),
    ]
    name: Annotated[
        str,
        ApiDescription(
            "Display name of the member's user, or their email address if they have no account yet"
        ),
    ]
    user: Annotated[
        UserSerializerResponse | None,
        ApiDescription(
            "The member's user. Null for invited members without an account, or if the user can't be found"
        ),
    ]
    orgRole: Annotated[str, ApiDescription("ID of the member's organization role")]
    pending: Annotated[
        bool,
        ApiDescription(
            "Whether the member has no user account linked yet, as with an invite that hasn't been accepted"
        ),
    ]
    expired: Annotated[bool, ApiDescription("Whether the member's invite has expired")]
    flags: Annotated[_OrganizationMemberFlags, ApiDescription("Member flags")]
    dateCreated: Annotated[datetime, ApiDescription("When the member was added or invited")]
    inviteStatus: Annotated[InviteStatusName | None, ApiDescription("Invite status")]
    inviterName: Annotated[
        str | None, ApiDescription("Name of the user who invited the member, or null")
    ]


class OrganizationMemberWithTeamsResponse(OrganizationMemberResponse):
    teams: Annotated[
        list[str],
        ApiDescription(
            "Deprecated. Slugs of the active teams the member belongs to. Use teamRoles"
        ),
    ]
    teamRoles: Annotated[
        list[_TeamRole],
        ApiDescription("Active teams the member belongs to, with the member's role in each"),
    ]


class OrganizationMemberWithProjectsResponse(OrganizationMemberResponse):
    projects: list[str]


@sentry_schema_serializer(
    omit_from_public_schema={
        "roles": "Deprecated, use orgRoleList.",
    }
)
class OrganizationMemberWithRolesResponse(OrganizationMemberWithTeamsResponse):
    roles: NotRequired[list[OrganizationRoleSerializerResponse]]  # Deprecated: use orgRoleList
    isOnlyOwner: Annotated[
        bool, ApiDescription("Whether the member is the only owner of the organization")
    ]
    orgRoleList: Annotated[
        list[OrganizationRoleSerializerResponse],
        ApiDescription("Organization roles, with whether the requesting user can assign each one"),
    ]
    teamRoleList: Annotated[
        list[TeamRoleSerializerResponse], ApiDescription("Team roles available in the organization")
    ]
