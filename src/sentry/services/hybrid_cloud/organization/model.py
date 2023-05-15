# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, List, Mapping, Optional

from pydantic import Field

from sentry.constants import ObjectStatus
from sentry.roles import team_roles
from sentry.roles.manager import TeamRole
from sentry.services.hybrid_cloud import RpcModel


class _DefaultEnumHelpers:
    """Helper functions to avoid importing sentry.models globally"""

    @staticmethod
    def get_default_team_status_value() -> int:
        from sentry.models import TeamStatus

        return TeamStatus.ACTIVE.value  # type: ignore[no-any-return]

    @staticmethod
    def get_default_invite_status_value() -> int:
        from sentry.models import InviteStatus

        return InviteStatus.APPROVED.value  # type: ignore[no-any-return]

    @staticmethod
    def get_default_organization_status_value() -> int:
        from sentry.models import OrganizationStatus

        return OrganizationStatus.ACTIVE.value  # type: ignore[no-any-return]


class RpcTeam(RpcModel):
    id: int = -1
    status: int = Field(default_factory=_DefaultEnumHelpers.get_default_team_status_value)
    organization_id: int = -1
    slug: str = ""
    actor_id: Optional[int] = None
    org_role: Optional[str] = None

    def class_name(self) -> str:
        return "Team"


class RpcTeamMember(RpcModel):
    id: int = -1
    slug: str = ""
    is_active: bool = False
    role_id: str = ""
    project_ids: List[int] = Field(default_factory=list)
    scopes: List[str] = Field(default_factory=list)
    team_id: int = -1

    @property
    def role(self) -> Optional[TeamRole]:
        return team_roles.get(self.role_id) if self.role_id else None


def project_status_visible() -> int:
    return int(ObjectStatus.ACTIVE)


class RpcProject(RpcModel):
    id: int = -1
    slug: str = ""
    name: str = ""
    organization_id: int = -1
    status: int = Field(default_factory=project_status_visible)


class RpcOrganizationMemberFlags(RpcModel):
    sso__linked: bool = False
    sso__invalid: bool = False
    member_limit__restricted: bool = False

    def __getattr__(self, item: str) -> bool:
        from sentry.services.hybrid_cloud.organization.serial import escape_flag_name

        item = escape_flag_name(item)
        return bool(getattr(self, item))

    def __getitem__(self, item: str) -> bool:
        return bool(getattr(self, item))


class RpcOrganizationMemberSummary(RpcModel):
    id: int = -1
    organization_id: int = -1
    user_id: Optional[int] = None  # This can be null when the user is deleted.
    flags: RpcOrganizationMemberFlags = Field(default_factory=lambda: RpcOrganizationMemberFlags())


class RpcOrganizationMember(RpcOrganizationMemberSummary):
    member_teams: List[RpcTeamMember] = Field(default_factory=list)
    role: str = ""
    has_global_access: bool = False
    project_ids: List[int] = Field(default_factory=list)
    scopes: List[str] = Field(default_factory=list)
    invite_status: int = Field(default_factory=_DefaultEnumHelpers.get_default_invite_status_value)
    token: str = ""
    is_pending: bool = False
    invite_approved: bool = False
    token_expired: bool = False
    legacy_token: str = ""
    email: str = ""

    def get_audit_log_metadata(self, user_email: Optional[str] = None) -> Mapping[str, Any]:
        from sentry.models.organizationmember import invite_status_names

        team_ids = [mt.team_id for mt in self.member_teams]
        team_slugs = [mt.slug for mt in self.member_teams]

        if user_email is None:
            user_email = self.email

        return {
            "email": user_email,
            "teams": team_ids,
            "has_global_access": self.has_global_access,
            "role": self.role,
            "invite_status": invite_status_names[self.invite_status],
            "user": self.user_id,
            "teams_slugs": team_slugs,
        }


class RpcOrganizationFlags(RpcModel):
    allow_joinleave: bool = False
    enhanced_privacy: bool = False
    disable_shared_issues: bool = False
    early_adopter: bool = False
    require_2fa: bool = False
    disable_new_visibility_features: bool = False
    require_email_verification: bool = False


class RpcOrganizationInvite(RpcModel):
    id: int = -1
    token: str = ""
    email: str = ""


class RpcOrganizationSummary(RpcModel):
    """
    The subset of organization metadata available from the control silo specifically.
    """

    slug: str = ""
    id: int = -1
    name: str = ""

    def __hash__(self) -> int:
        # Mimic the behavior of hashing a Django ORM entity, for compatibility with
        # serializers, as this organization summary object is often used for that.
        return hash((self.id, self.slug))


class RpcOrganization(RpcOrganizationSummary):
    # Represents the full set of teams and projects associated with the org.  Note that these are not filtered by
    # visibility, but you can apply a manual filter on the status attribute.
    teams: List[RpcTeam] = Field(default_factory=list)
    projects: List[RpcProject] = Field(default_factory=list)

    flags: RpcOrganizationFlags = Field(default_factory=lambda: RpcOrganizationFlags())
    status: int = Field(default_factory=_DefaultEnumHelpers.get_default_organization_status_value)

    default_role: str = ""


class RpcUserOrganizationContext(RpcModel):
    """
    This object wraps an organization result inside of its membership context in terms of an (optional) user id.
    This is due to the large number of callsites that require an organization and a user's membership at the
    same time and in a consistency state.  This object allows a nice envelop for both of these ideas from a single
    transactional query.  Used by access, determine_active_organization, and others.
    """

    # user_id is None iff the get_organization_by_id call is not provided a user_id context.
    user_id: Optional[int] = None
    # The organization is always non-null because the null wrapping is around this object instead.
    # A None organization => a None RpcUserOrganizationContext
    organization: RpcOrganization = Field(default_factory=lambda: RpcOrganization())
    # member can be None when the given user_id does not have membership with the given organization.
    # Note that all related fields of this organization member are filtered by visibility and is_active=True.
    member: Optional[RpcOrganizationMember] = None

    def __post_init__(self) -> None:
        # Ensures that outer user_id always agrees with the inner member object.
        if self.user_id is not None and self.member is not None:
            assert self.user_id == self.member.user_id


class RpcUserInviteContext(RpcUserOrganizationContext):
    """
    A context containing an intended organization member object as a potential invite, and the true
    inner organization member state as found for a given user_id if it exists, or just the organization
    member state of the invite if none such exists.
    """

    invite_organization_member_id: int = 0
