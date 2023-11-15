# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from datetime import datetime
from enum import IntEnum
from typing import Any, List, Mapping, Optional, Sequence

from django.dispatch import Signal
from django.utils import timezone
from pydantic import Field
from typing_extensions import TypedDict

from sentry import roles
from sentry.db.models import ValidateFunction, Value
from sentry.models.options.option import HasOption
from sentry.roles import team_roles
from sentry.roles.manager import TeamRole
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.project import RpcProject
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.util import flags_to_bits
from sentry.signals import sso_enabled
from sentry.silo.base import SiloMode
from sentry.types.organization import OrganizationAbsoluteUrlMixin


class _DefaultEnumHelpers:
    """Helper functions to avoid importing sentry.models globally"""

    @staticmethod
    def get_default_team_status_value() -> int:
        from sentry.models.team import TeamStatus

        return TeamStatus.ACTIVE

    @staticmethod
    def get_default_invite_status_value() -> int:
        from sentry.models.organizationmember import InviteStatus

        return InviteStatus.APPROVED.value

    @staticmethod
    def get_default_organization_status_value() -> int:
        from sentry.models.organization import OrganizationStatus

        return OrganizationStatus.ACTIVE.value


class RpcTeam(RpcModel):
    id: int = -1
    status: int = Field(default_factory=_DefaultEnumHelpers.get_default_team_status_value)
    organization_id: int = -1
    slug: str = ""
    actor_id: Optional[int] = None
    org_role: Optional[str] = None
    name: str = ""

    def class_name(self) -> str:
        return "Team"

    def get_audit_log_data(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "status": self.status,
            "org_role": self.org_role,
        }


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


class RpcOrganizationMemberTeam(RpcModel):
    id: int = -1
    team_id: int = -1
    organizationmember_id: int = -1
    organization_id: int = -1
    is_active: bool = False
    role: Optional[str] = None


class RpcOrganizationMemberFlags(RpcModel):
    sso__linked: bool = False
    sso__invalid: bool = False
    member_limit__restricted: bool = False
    idp__provisioned: bool = False
    idp__role_restricted: bool = False
    partnership__restricted: bool = False

    def __getattr__(self, item: str) -> bool:
        from sentry.services.hybrid_cloud.organization.serial import escape_flag_name

        item = escape_flag_name(item)
        return bool(getattr(self, item))

    def __setattr__(self, item: str, value: bool) -> None:
        from sentry.services.hybrid_cloud.organization.serial import escape_flag_name

        item = escape_flag_name(item)
        super().__setattr__(item, value)

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


# Add new organization flags to RpcOrganizationFlags first, only add them here after
# they have been replicated via Organization.handle_async_replication logic
class RpcOrganizationMappingFlags(RpcModel):
    early_adopter: bool = False
    require_2fa: bool = False
    allow_joinleave: bool = False
    enhanced_privacy: bool = False
    disable_shared_issues: bool = False
    disable_new_visibility_features: bool = False
    require_email_verification: bool = False
    codecov_access: bool = False


class RpcOrganizationFlags(RpcOrganizationMappingFlags):
    def as_int(self):
        # Must maintain the same order as the ORM's `Organization.flags` fields
        return flags_to_bits(
            self.allow_joinleave,
            self.enhanced_privacy,
            self.disable_shared_issues,
            self.early_adopter,
            self.require_2fa,
            self.disable_new_visibility_features,
            self.require_email_verification,
            self.codecov_access,
        )


class RpcOrganizationFlagsUpdate(TypedDict):
    require_2fa: bool


class RpcOrganizationInvite(RpcModel):
    id: int = -1
    token: str = ""
    email: str = ""


class RpcOrganizationSummary(RpcModel, OrganizationAbsoluteUrlMixin, HasOption):
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

    def get_option(
        self, key: str, default: Optional[Value] = None, validate: Optional[ValidateFunction] = None
    ) -> Value:
        from sentry.services.hybrid_cloud.organization import organization_service

        return organization_service.get_option(organization_id=self.id, key=key)

    def update_option(self, key: str, value: Value) -> bool:
        from sentry.services.hybrid_cloud.organization import organization_service

        return organization_service.update_option(organization_id=self.id, key=key, value=value)

    def delete_option(self, key: str) -> None:
        from sentry.services.hybrid_cloud.organization import organization_service

        organization_service.delete_option(organization_id=self.id, key=key)


class RpcOrganization(RpcOrganizationSummary):
    # Represents the full set of teams and projects associated with the org.  Note that these are not filtered by
    # visibility, but you can apply a manual filter on the status attribute.
    teams: List[RpcTeam] = Field(default_factory=list)
    projects: List[RpcProject] = Field(default_factory=list)

    flags: RpcOrganizationFlags = Field(default_factory=lambda: RpcOrganizationFlags())
    status: int = Field(default_factory=_DefaultEnumHelpers.get_default_organization_status_value)

    default_role: str = ""
    date_added: datetime = Field(default_factory=timezone.now)

    def get_audit_log_data(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "status": self.status,
            "flags": self.flags.as_int(),
            "default_role": self.default_role,
        }

    def get_owners(self) -> Sequence[RpcUser]:
        from sentry.models.organizationmember import OrganizationMember
        from sentry.models.organizationmembermapping import OrganizationMemberMapping
        from sentry.services.hybrid_cloud.user.service import user_service

        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            owners = OrganizationMemberMapping.objects.filter(
                organization_id=self.id, role__in=[roles.get_top_dog().id]
            ).values_list("user_id", flat=True)
        else:
            owners = OrganizationMember.objects.filter(
                organization_id=self.id, role__in=[roles.get_top_dog().id]
            ).values_list("user_id", flat=True)
        return user_service.get_many(filter={"user_ids": list(owners)})


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

    invite_organization_member_id: Optional[int] = 0


class RpcRegionUser(RpcModel):
    """
    Represents user information that may be propagated to each region that a user belongs to, often to make
    more performant queries on organization member information.
    """

    id: int = -1
    is_active: bool = True
    email: Optional[str] = None


class RpcOrganizationSignal(IntEnum):
    INTEGRATION_ADDED = 1
    MEMBER_JOINED = 2
    SSO_ENABLED = 3

    @classmethod
    def from_signal(cls, signal: Signal) -> "RpcOrganizationSignal":
        for enum, s in cls.signal_map().items():
            if s is signal:
                return enum
        raise ValueError(f"Signal {signal!r} is not a valid RpcOrganizationSignal")

    @classmethod
    def signal_map(cls) -> Mapping["RpcOrganizationSignal", Signal]:
        from sentry.signals import integration_added, member_joined

        return {
            RpcOrganizationSignal.INTEGRATION_ADDED: integration_added,
            RpcOrganizationSignal.MEMBER_JOINED: member_joined,
            RpcOrganizationSignal.SSO_ENABLED: sso_enabled,
        }

    @property
    def signal(self) -> Signal:
        return self.signal_map()[self]


class RpcOrganizationDeleteState(IntEnum):
    PENDING_DELETION = 1
    CANNOT_REMOVE_DEFAULT_ORG = 2
    OWNS_PUBLISHED_INTEGRATION = 3
    NO_OP = 4


class RpcOrganizationDeleteResponse(RpcModel):
    response_state: RpcOrganizationDeleteState
    updated_organization: Optional[RpcOrganization] = None
    schedule_guid: str = ""


class RpcAuditLogEntryActor(RpcModel):
    actor_label: Optional[str]
    actor_id: int
    actor_key: Optional[str]
    ip_address: Optional[str]


class OrganizationMemberUpdateArgs(TypedDict, total=False):
    flags: Optional[RpcOrganizationMemberFlags]
    role: str
    invite_status: int
