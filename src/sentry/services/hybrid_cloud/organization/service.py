# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
import abc
from abc import abstractmethod
from collections.abc import Mapping
from typing import Any

from django.dispatch import Signal

from sentry.services.hybrid_cloud import OptionValue, silo_mode_delegation
from sentry.services.hybrid_cloud.organization.model import (
    OrganizationMemberUpdateArgs,
    RpcAuditLogEntryActor,
    RpcOrganization,
    RpcOrganizationDeleteResponse,
    RpcOrganizationFlagsUpdate,
    RpcOrganizationMember,
    RpcOrganizationMemberFlags,
    RpcOrganizationMemberSummary,
    RpcOrganizationSignal,
    RpcOrganizationSummary,
    RpcRegionUser,
    RpcTeam,
    RpcUserInviteContext,
    RpcUserOrganizationContext,
)
from sentry.services.hybrid_cloud.region import (
    ByOrganizationId,
    ByOrganizationIdAttribute,
    ByOrganizationSlug,
    ByRegionName,
    RequireSingleOrganization,
)
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.silo import SiloMode


class OrganizationService(RpcService):
    key = "organization"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.organization.impl import DatabaseBackedOrganizationService

        return DatabaseBackedOrganizationService()

    def get(self, id: int) -> RpcOrganization | None:
        org_context = self.get_organization_by_id(id=id)

        return org_context.organization if org_context else None

    @regional_rpc_method(resolve=ByOrganizationId("id"))
    @abstractmethod
    def serialize_organization(
        self,
        *,
        id: int,
        as_user: RpcUser | None = None,
    ) -> Any | None:
        """
        Attempts to serialize a given organization.  Note that this can be None if the organization is already deleted
        in the corresponding region silo.
        """

    @regional_rpc_method(resolve=ByOrganizationId("id"), return_none_if_mapping_not_found=True)
    @abstractmethod
    def get_organization_by_id(
        self,
        *,
        id: int,
        user_id: int | None = None,
        slug: str | None = None,
        include_projects: bool | None = True,
        include_teams: bool | None = True,
    ) -> RpcUserOrganizationContext | None:
        """
        Fetches the organization, team, and project data given by an organization id, regardless of its visibility
        status.  When user_id is provided, membership data related to that user from the organization
        is also given in the response.  See RpcUserOrganizationContext for more info.
        """

    @regional_rpc_method(resolve=ByOrganizationSlug(), return_none_if_mapping_not_found=True)
    @abstractmethod
    def get_org_by_slug(
        self,
        *,
        slug: str,
        user_id: int | None = None,
    ) -> RpcOrganizationSummary | None:
        """
        Fetches the organization, by an organization slug. If user_id is passed, it will enforce visibility
        rules. This method is differentiated from get_organization_by_slug by not being cached and returning
        RpcOrganizationSummary instead of org contexts
        """

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_organizations_by_user_and_scope(
        self, *, region_name: str, user: RpcUser, scope: str | None = None
    ) -> list[RpcOrganization]:
        """
        Fetches organizations for the given user, with the given organization member scope.
        """

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update_flags(self, *, organization_id: int, flags: RpcOrganizationFlagsUpdate) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def check_membership_by_email(
        self, *, organization_id: int, email: str
    ) -> RpcOrganizationMember | None:
        """
        Used to look up an organization membership by an email
        """

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def check_membership_by_id(
        self, *, organization_id: int, user_id: int
    ) -> RpcOrganizationMember | None:
        """
        Used to look up an organization membership by a user id
        """

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_member_summaries_by_ids(
        self, *, organization_id: int, user_ids: list[int]
    ) -> list[RpcOrganizationMemberSummary]:
        """
        Used to look up multiple membership summaries by users' id.
        """

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_invite_by_id(
        self,
        *,
        organization_id: int,
        organization_member_id: int | None = None,
        user_id: int | None = None,
        email: str | None = None,
    ) -> RpcUserInviteContext | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationSlug(), return_none_if_mapping_not_found=True)
    @abstractmethod
    def get_invite_by_slug(
        self,
        *,
        slug: str,
        organization_member_id: int | None = None,
        user_id: int | None = None,
        email: str | None = None,
    ) -> RpcUserInviteContext | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def delete_organization_member(
        self, *, organization_id: int, organization_member_id: int
    ) -> bool:
        """
        Delete an organization member by its id.
        """

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def set_user_for_organization_member(
        self,
        *,
        organization_member_id: int,
        organization_id: int,
        user_id: int,
    ) -> RpcOrganizationMember | None:
        """
        Set the user id for an organization member.
        """

    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> int | None:
        """
        If exists and matches the only_visible requirement, returns an organization's id by the slug.
        """
        return _organization_check_service.check_organization_by_slug(
            slug=slug, only_visible=only_visible
        )

    def check_organization_by_id(self, *, id: int, only_visible: bool) -> bool:
        """
        Checks if an organization exists by the id.
        """
        return _organization_check_service.check_organization_by_id(
            id=id, only_visible=only_visible
        )

    def get_organization_by_slug(
        self,
        *,
        slug: str,
        only_visible: bool,
        user_id: int | None = None,
        include_projects: bool | None = True,
        include_teams: bool | None = True,
    ) -> RpcUserOrganizationContext | None:
        """
        Defers to check_organization_by_slug and get_organization_by_id
        """
        from sentry.models.organization import OrganizationStatus

        org_id = self.check_organization_by_slug(slug=slug, only_visible=only_visible)
        if org_id is None:
            return None

        org_context = self.get_organization_by_id(
            id=org_id,
            user_id=user_id,
            include_projects=include_projects,
            include_teams=include_teams,
        )
        if (
            only_visible
            and org_context
            and org_context.organization.status != OrganizationStatus.ACTIVE
        ):
            return None
        return org_context

    @regional_rpc_method(resolve=RequireSingleOrganization())
    @abstractmethod
    def get_default_organization(self) -> RpcOrganization:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def add_organization_member(
        self,
        *,
        organization_id: int,
        default_org_role: str,
        user_id: int | None = None,
        email: str | None = None,
        flags: RpcOrganizationMemberFlags | None = None,
        role: str | None = None,
        inviter_id: int | None = None,
        invite_status: int | None = None,
    ) -> RpcOrganizationMember:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update_organization_member(
        self, *, organization_id: int, member_id: int, attrs: OrganizationMemberUpdateArgs
    ) -> RpcOrganizationMember | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_single_team(self, *, organization_id: int) -> RpcTeam | None:
        """If the organization has exactly one team, return it.

        Return None if the organization has no teams or more than one.
        """

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def add_team_member(
        self, *, organization_id: int, team_id: int, organization_member_id: int
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_or_create_team_member(
        self,
        organization_id: int,
        *,
        team_id: int,
        organization_member_id: int,
        role: str | None,
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_or_create_default_team(
        self,
        *,
        organization_id: int,
        new_team_slug: str,
    ) -> RpcTeam:
        pass

    @regional_rpc_method(resolve=ByOrganizationIdAttribute("organization_member"))
    @abstractmethod
    def update_membership_flags(self, *, organization_member: RpcOrganizationMember) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def merge_users(self, *, organization_id: int, from_user_id: int, to_user_id: int) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update_default_role(self, *, organization_id: int, default_role: str) -> RpcOrganization:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def remove_user(self, *, organization_id: int, user_id: int) -> RpcOrganizationMember | None:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def update_region_user(self, *, user: RpcRegionUser, region_name: str) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def reset_idp_flags(self, *, organization_id: int) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_option(self, *, organization_id: int, key: str) -> OptionValue:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update_option(self, *, organization_id: int, key: str, value: OptionValue) -> bool:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def delete_option(self, *, organization_id: int, key: str) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def send_sso_link_emails(
        self, *, organization_id: int, sending_user_email: str, provider_key: str
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def send_sso_unlink_emails(
        self, *, organization_id: int, sending_user_email: str, provider_key: str
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def count_members_without_sso(self, *, organization_id: int) -> int:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def delete_organization(
        self, *, organization_id: int, user: RpcUser
    ) -> RpcOrganizationDeleteResponse:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def create_org_delete_log(
        self, *, organization_id: int, audit_log_actor: RpcAuditLogEntryActor
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def send_signal(
        self,
        *,
        signal: RpcOrganizationSignal,
        organization_id: int,
        args: Mapping[str, int | str | None],
    ) -> None:
        pass

    def schedule_signal(
        self,
        signal: Signal,
        organization_id: int,
        args: Mapping[str, int | str | None],
    ) -> None:
        _organization_signal_service.schedule_signal(
            signal=signal, organization_id=organization_id, args=args
        )

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_organization_owner_members(
        self, *, organization_id: int
    ) -> list[RpcOrganizationMember]:
        pass


class OrganizationCheckService(abc.ABC):
    @abstractmethod
    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> int | None:
        """
        If exists and matches the only_visible requirement, returns an organization's id by the slug.
        """

    @abstractmethod
    def check_organization_by_id(self, *, id: int, only_visible: bool) -> bool:
        """
        Checks if an organization exists by the id.
        """


def _control_check_organization() -> OrganizationCheckService:
    from sentry.services.hybrid_cloud.organization.impl import ControlOrganizationCheckService

    return ControlOrganizationCheckService()


def _region_check_organization() -> OrganizationCheckService:
    from sentry.services.hybrid_cloud.organization.impl import RegionOrganizationCheckService

    return RegionOrganizationCheckService()


class OrganizationSignalService(abc.ABC):
    @abc.abstractmethod
    def schedule_signal(
        self,
        signal: Signal,
        organization_id: int,
        args: Mapping[str, int | str | None],
    ) -> None:
        pass


def _signal_from_outbox() -> OrganizationSignalService:
    from sentry.services.hybrid_cloud.organization.impl import OutboxBackedOrganizationSignalService

    return OutboxBackedOrganizationSignalService()


def _signal_from_on_commit() -> OrganizationSignalService:
    from sentry.services.hybrid_cloud.organization.impl import (
        OnCommitBackedOrganizationSignalService,
    )

    return OnCommitBackedOrganizationSignalService()


_organization_check_service: OrganizationCheckService = silo_mode_delegation(
    {
        SiloMode.REGION: _region_check_organization,
        SiloMode.CONTROL: _control_check_organization,
        SiloMode.MONOLITH: _region_check_organization,
    }
)


_organization_signal_service: OrganizationSignalService = silo_mode_delegation(
    {
        SiloMode.REGION: _signal_from_on_commit,
        SiloMode.CONTROL: _signal_from_outbox,
        SiloMode.MONOLITH: _signal_from_on_commit,
    }
)

organization_service = OrganizationService.create_delegation()
