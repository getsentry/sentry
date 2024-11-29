from __future__ import annotations

from collections.abc import Mapping
from typing import Any, cast

from django.contrib.postgres.aggregates import BitOr
from django.db import models, router, transaction
from django.db.models.expressions import CombinedExpression, F
from django.dispatch import Signal

from sentry import roles
from sentry.api.serializers import serialize
from sentry.backup.dependencies import merge_users_for_model_in_org
from sentry.db.postgres.transactions import enforce_constraints
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.hybridcloud.models.outbox import ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.hybridcloud.rpc import OptionValue, logger
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleActivity
from sentry.incidents.models.incident import IncidentActivity, IncidentSubscription
from sentry.models.activity import Activity
from sentry.models.dashboard import Dashboard, DashboardFavoriteUser
from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupseen import GroupSeen
from sentry.models.groupshare import GroupShare
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.projectbookmark import ProjectBookmark
from sentry.models.recentsearch import RecentSearch
from sentry.models.rule import Rule, RuleActivity
from sentry.models.rulesnooze import RuleSnooze
from sentry.models.savedsearch import SavedSearch
from sentry.models.team import Team, TeamStatus
from sentry.monitors.models import Monitor
from sentry.organizations.services.organization import (
    OrganizationCheckService,
    OrganizationService,
    OrganizationSignalService,
    RpcOrganization,
    RpcOrganizationFlagsUpdate,
    RpcOrganizationInvite,
    RpcOrganizationMember,
    RpcOrganizationMemberFlags,
    RpcOrganizationSignal,
    RpcOrganizationSummary,
    RpcRegionUser,
    RpcTeam,
    RpcUserInviteContext,
    RpcUserOrganizationContext,
)
from sentry.organizations.services.organization.model import (
    OrganizationMemberUpdateArgs,
    RpcAuditLogEntryActor,
    RpcOrganizationDeleteResponse,
    RpcOrganizationDeleteState,
    RpcOrganizationMemberSummary,
    flags_to_bits,
)
from sentry.organizations.services.organization.serial import (
    serialize_member,
    serialize_organization_summary,
    serialize_rpc_organization,
    serialize_rpc_team,
    summarize_member,
)
from sentry.organizations.services.organization_actions.impl import (
    mark_organization_as_pending_deletion_with_outbox_message,
)
from sentry.projects.services.project import RpcProjectFlags
from sentry.sentry_apps.services.app import app_service
from sentry.silo.safety import unguarded_write
from sentry.tasks.auth import email_unlink_notifications
from sentry.types.region import find_regions_for_orgs
from sentry.users.services.user import RpcUser
from sentry.utils.audit import create_org_delete_log


class DatabaseBackedOrganizationService(OrganizationService):
    def check_membership_by_id(
        self, organization_id: int, user_id: int
    ) -> RpcOrganizationMember | None:
        try:
            member = OrganizationMember.objects.get(
                user_id=user_id, organization_id=organization_id
            )
        except OrganizationMember.DoesNotExist:
            return None

        return serialize_member(member)

    def get_member_summaries_by_ids(
        self, *, organization_id: int, user_ids: list[int]
    ) -> list[RpcOrganizationMemberSummary]:
        members = OrganizationMember.objects.filter(
            organization_id=organization_id, user_id__in=user_ids
        )
        return [summarize_member(m) for m in members]

    def serialize_organization(self, *, id: int, as_user: RpcUser | None = None) -> Any | None:
        org = Organization.objects.filter(id=id).first()
        if org is None:
            return None
        return serialize(org, user=as_user)

    def get_organization_by_id(
        self,
        *,
        id: int,
        user_id: int | None = None,
        slug: str | None = None,
        include_projects: bool | None = True,
        include_teams: bool | None = True,
    ) -> RpcUserOrganizationContext | None:
        membership: RpcOrganizationMember | None = None
        if user_id is not None:
            membership = self.check_membership_by_id(organization_id=id, user_id=user_id)

        try:
            query = Organization.objects.filter(id=id)
            if slug is not None:
                query = query.filter(slug=slug)
            org = query.get()
        except Organization.DoesNotExist:
            return None

        return RpcUserOrganizationContext(
            user_id=user_id,
            organization=serialize_rpc_organization(
                org, include_projects=include_projects, include_teams=include_teams
            ),
            member=membership,
        )

    def get_org_by_slug(
        self,
        *,
        slug: str,
        user_id: int | None = None,
    ) -> RpcOrganizationSummary | None:
        query = Organization.objects.filter(slug=slug)
        if user_id is not None:
            query = query.filter(
                status=OrganizationStatus.ACTIVE,
                member_set__user_id=user_id,
            )
        try:
            return serialize_organization_summary(query.get())
        except Organization.DoesNotExist:
            return None

    def get_org_by_id(
        self,
        *,
        id: int,
        user_id: int | None = None,
    ) -> RpcOrganizationSummary | None:
        query = Organization.objects.filter(id=id)
        if user_id is not None:
            query = query.filter(
                status=OrganizationStatus.ACTIVE,
                member_set__user_id=user_id,
            )
        try:
            return serialize_organization_summary(query.get())
        except Organization.DoesNotExist:
            return None

    def get_organizations_by_user_and_scope(
        self, *, region_name: str, user: RpcUser, scope: str | None = None
    ) -> list[RpcOrganization]:
        organizations = Organization.objects.get_for_user(user=user, scope=scope)
        return list(map(serialize_rpc_organization, organizations))

    def get_default_organization(self) -> RpcOrganization:
        return serialize_rpc_organization(Organization.get_default())

    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> RpcOrganizationMember | None:
        try:
            member = OrganizationMember.objects.get(
                organization_id=organization_id, email__iexact=email
            )
        except OrganizationMember.DoesNotExist:
            return None

        return serialize_member(member)

    def get_invite_by_id(
        self,
        *,
        organization_id: int,
        organization_member_id: int | None = None,
        user_id: int | None = None,
        email: str | None = None,
    ) -> RpcUserInviteContext | None:
        """
        Query for an organization member by its id.
        """
        query = Organization.objects.filter(id=organization_id)

        try:
            org = query.get()
        except Organization.DoesNotExist:
            return None

        return self._get_invite(
            organization_member_id=organization_member_id,
            org=org,
            user_id=user_id,
            email=email,
        )

    def get_invite_by_slug(
        self,
        *,
        slug: str,
        organization_member_id: int | None = None,
        user_id: int | None = None,
        email: str | None = None,
    ) -> RpcUserInviteContext | None:
        """
        Query for an organization member by its slug.
        """
        query = Organization.objects.filter(slug=slug)

        try:
            org = query.get()
        except Organization.DoesNotExist:
            return None

        return self._get_invite(
            organization_member_id=organization_member_id,
            org=org,
            user_id=user_id,
            email=email,
        )

    def _get_invite(
        self,
        *,
        organization_member_id: int | None = None,
        org: Organization,
        user_id: int | None = None,
        email: str | None = None,
    ) -> RpcUserInviteContext | None:
        """
        Query for an organization member by its id and organization
        """

        member: OrganizationMember | None = None
        if user_id is not None:
            member = OrganizationMember.objects.filter(
                organization_id=org.id, user_id=user_id
            ).first()
        if member is None and email is not None:
            member = OrganizationMember.objects.filter(
                organization_id=org.id, email__iexact=email
            ).first()
        if member is None and organization_member_id is not None:
            member = OrganizationMember.objects.filter(
                organization_id=org.id, id=organization_member_id
            ).first()

        if member is None:
            return None

        return RpcUserInviteContext(
            user_id=member.user_id,
            organization=serialize_rpc_organization(org),
            member=serialize_member(member),
            invite_organization_member_id=organization_member_id,
        )

    def delete_organization_member(
        self, *, organization_id: int, organization_member_id: int
    ) -> bool:
        try:
            member = OrganizationMember.objects.get(id=organization_member_id)
        except OrganizationMember.DoesNotExist:
            return False
        num_deleted, _deleted = member.delete()
        return num_deleted > 0

    def set_user_for_organization_member(
        self,
        *,
        organization_member_id: int,
        organization_id: int,
        user_id: int,
    ) -> RpcOrganizationMember | None:
        with transaction.atomic(router.db_for_write(OrganizationMember)):
            try:
                org_member = OrganizationMember.objects.get(
                    user_id=user_id, organization_id=organization_id
                )
                return serialize_member(org_member)
            except OrganizationMember.DoesNotExist:
                try:
                    org_member = OrganizationMember.objects.get(
                        id=organization_member_id, organization_id=organization_id
                    )
                    org_member.set_user(user_id)
                    org_member.save()
                except OrganizationMember.DoesNotExist:
                    return None
        return serialize_member(org_member)

    def _query_organizations(
        self, user_id: int, scope: str | None, only_visible: bool
    ) -> list[Organization]:
        from django.conf import settings

        if settings.SENTRY_PUBLIC and scope is None:
            if only_visible:
                return list(Organization.objects.filter(status=OrganizationStatus.ACTIVE))
            else:
                return list(Organization.objects.filter())

        qs = OrganizationMember.objects.filter(user_id=user_id)

        qs = qs.select_related("organization")
        if only_visible:
            qs = qs.filter(organization__status=OrganizationStatus.ACTIVE)

        results = list(qs)

        if scope is not None:
            return [r.organization for r in results if scope in r.get_scopes()]

        return [r.organization for r in results]

    def update_flags(self, *, organization_id: int, flags: RpcOrganizationFlagsUpdate) -> None:
        updates: F | CombinedExpression = models.F("flags")
        for name, value in flags.items():
            if value is True:
                updates = updates.bitor(getattr(Organization.flags, name))
            elif value is False:
                updates = updates.bitand(~getattr(Organization.flags, name))
            else:
                raise TypeError(f"Invalid value received for update_flags: {name}={value!r}")

        with outbox_context(transaction.atomic(router.db_for_write(Organization))):
            Organization.objects.filter(id=organization_id).update(flags=updates)
            Organization(id=organization_id).outbox_for_update().save()

    def get_aggregate_project_flags(self, *, organization_id: int) -> RpcProjectFlags:
        """We need to do some bitfield magic here to convert the aggregate flag into the correct format, because the
        original class does not let us instantiate without being tied to the database/django:
        1. Convert the integer into a binary representation
        2. Pad the string with the number of leading zeros so the length of the binary representation lines up with the
           number of bits of MAX_BIGINT / the BitField
        3. Reverse the binary representation to correctly assign flags based on the order
        4. Serialize as an RpcProjectFlags object
        """
        flag_keys = cast(list[str], Project.flags)

        projects = Project.objects.filter(organization_id=organization_id)
        if projects.count() > 0:
            aggregate_flag = projects.aggregate(bitor_result=BitOr(F("flags")))
            binary_repr = str(bin(aggregate_flag["bitor_result"]))[2:]
            padded_binary_repr = "0" * (64 - len(binary_repr)) + binary_repr
            flag_values = list(padded_binary_repr)[::-1]

        else:
            flag_values = ["0"] * len(list(flag_keys))

        flag_dict = dict(zip(flag_keys, flag_values))
        return RpcProjectFlags(**flag_dict)

    @staticmethod
    def _deserialize_member_flags(flags: RpcOrganizationMemberFlags) -> int:
        return flags_to_bits(
            flags.sso__linked,
            flags.sso__invalid,
            flags.member_limit__restricted,
            flags.idp__provisioned,
            flags.idp__role_restricted,
            flags.partnership__restricted,
        )

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
        assert (user_id is None and email) or (
            user_id and email is None
        ), "Must set either user_id or email"
        if invite_status is None:
            invite_status = InviteStatus.APPROVED.value

        with outbox_context(transaction.atomic(router.db_for_write(OrganizationMember))):
            org_member: OrganizationMember | None = None
            if user_id is not None:
                org_member = OrganizationMember.objects.filter(
                    organization_id=organization_id, user_id=user_id
                ).first()
            elif email is not None:
                org_member = OrganizationMember.objects.filter(
                    organization_id=organization_id, email=email
                ).first()

            if org_member is None:
                org_member = OrganizationMember.objects.create(
                    organization_id=organization_id,
                    user_id=user_id,
                    email=email,
                    flags=self._deserialize_member_flags(flags) if flags else 0,
                    role=role or default_org_role,
                    inviter_id=inviter_id,
                    invite_status=invite_status,
                )
        return serialize_member(org_member)

    def update_organization_member(
        self, *, organization_id: int, member_id: int, attrs: OrganizationMemberUpdateArgs
    ) -> RpcOrganizationMember | None:
        member = OrganizationMember.objects.get(id=member_id)
        with outbox_context(transaction.atomic(router.db_for_write(OrganizationMember))):
            if len(attrs):
                for k, v in attrs.items():
                    setattr(member, k, v)
                member.save()

        return serialize_member(member)

    def get_single_team(self, *, organization_id: int) -> RpcTeam | None:
        teams = list(Team.objects.filter(organization_id=organization_id)[0:2])
        if len(teams) == 1:
            (team,) = teams
            return serialize_rpc_team(team)
        return None

    def add_team_member(
        self, *, organization_id: int, team_id: int, organization_member_id: int
    ) -> None:
        OrganizationMemberTeam.objects.create(
            team_id=team_id, organizationmember_id=organization_member_id
        )
        # It might be nice to return an RpcTeamMember to represent what we just
        # created, but doing so would require a list of project IDs. We can implement
        # that if a return value is needed in the future.

    def get_or_create_default_team(
        self,
        *,
        organization_id: int,
        new_team_slug: str,
    ) -> RpcTeam:
        team_query = Team.objects.filter(
            organization_id=organization_id, status=TeamStatus.ACTIVE
        ).order_by("date_added")
        if team_query.exists():
            team = team_query[0]
        else:
            team = Team.objects.create(
                organization_id=organization_id, slug=new_team_slug, name=new_team_slug
            )
        return serialize_rpc_team(team)

    def get_or_create_team_member(
        self,
        *,
        organization_id: int,
        team_id: int,
        organization_member_id: int,
        role: str | None = "contributor",
    ) -> None:
        team_member_query = OrganizationMemberTeam.objects.filter(
            team_id=team_id, organizationmember_id=organization_member_id
        )
        if team_member_query.exists():
            team_member = team_member_query[0]
            if role and team_member.role != role:
                team_member.update(role=role)
        else:
            team_member = OrganizationMemberTeam.objects.create(
                team_id=team_id, organizationmember_id=organization_member_id, role=role
            )
        # It might be nice to return an RpcTeamMember to represent what we just
        # created, but doing so would require a list of project IDs. We can implement
        # that if a return value is needed in the future.

    def update_membership_flags(self, *, organization_member: RpcOrganizationMember) -> None:
        model = OrganizationMember.objects.get(id=organization_member.id)
        model.flags = self._deserialize_member_flags(organization_member.flags)  # type: ignore[assignment]  # TODO: make BitField a mypy plugin
        model.save()

    @classmethod
    def _serialize_invite(cls, om: OrganizationMember) -> RpcOrganizationInvite:
        return RpcOrganizationInvite(id=om.id, token=om.token, email=om.email)

    def update_default_role(self, *, organization_id: int, default_role: str) -> RpcOrganization:
        org = Organization.objects.get(id=organization_id)
        org.default_role = default_role
        org.save()
        return serialize_rpc_organization(org)

    def remove_user(self, *, organization_id: int, user_id: int) -> RpcOrganizationMember | None:
        with outbox_context(transaction.atomic(router.db_for_write(OrganizationMember))):
            try:
                org_member = OrganizationMember.objects.get(
                    organization_id=organization_id, user_id=user_id
                )
            except OrganizationMember.DoesNotExist:
                return None

            org_member.remove_user()
            if org_member.email:
                org_member.save()
            else:
                return None

        return serialize_member(org_member)

    def merge_users(self, *, organization_id: int, from_user_id: int, to_user_id: int) -> None:
        to_member: OrganizationMember | None = OrganizationMember.objects.filter(
            organization_id=organization_id, user_id=to_user_id
        ).first()

        from_member: OrganizationMember | None = OrganizationMember.objects.filter(
            organization_id=organization_id, user_id=from_user_id
        ).first()

        if from_member is None:
            return

        if to_member is None:
            to_member = OrganizationMember.objects.create(  # type: ignore[misc]  # TODO: make BitField a mypy plugin
                organization_id=organization_id,
                user_id=to_user_id,
                role=from_member.role,
                flags=from_member.flags,
                has_global_access=from_member.has_global_access,
            )
        else:
            if roles.get(from_member.role).priority > roles.get(to_member.role).priority:
                to_member.role = from_member.role
            to_member.save()

        assert to_member

        with enforce_constraints(transaction.atomic(using=router.db_for_write(OrganizationMember))):
            # Delete all org access requests between the two now-merged users.
            OrganizationAccessRequest.objects.filter(
                member=from_member, requester_id=to_user_id
            ).delete()
            OrganizationAccessRequest.objects.filter(
                member=to_member, requester_id=from_user_id
            ).delete()

            # All other org access requests should be pointed from the old member to the new
            # one.
            reqs = OrganizationAccessRequest.objects.filter(member=from_member)
            for req in reqs:
                req.member = to_member
                req.save()

            # Move all old team memberships to the newly merged `OrganizationMember`.
            for team in from_member.teams.all():
                OrganizationMemberTeam.objects.filter(
                    organizationmember=from_member, team=team
                ).delete()
                to_member_team = OrganizationMemberTeam.objects.filter(
                    organizationmember=to_member, team=team
                ).first()
                if to_member_team is None:
                    OrganizationMemberTeam.objects.create(organizationmember=to_member, team=team)

            # Update all organization region models to only use the new user id.
            model_list = [
                Activity,
                AlertRule,
                AlertRuleActivity,
                CustomDynamicSamplingRule,
                Dashboard,
                DashboardFavoriteUser,
                GroupAssignee,
                GroupBookmark,
                GroupSeen,
                GroupShare,
                GroupSearchView,
                GroupSubscription,
                IncidentActivity,
                IncidentSubscription,
                OrganizationAccessRequest,
                ProjectBookmark,
                RecentSearch,
                Rule,
                RuleActivity,
                RuleSnooze,
                SavedSearch,
            ]
            for model in model_list:
                merge_users_for_model_in_org(
                    model,
                    organization_id=organization_id,
                    from_user_id=from_user_id,
                    to_user_id=to_user_id,
                )

            # Finally, delete the old member.
            from_member.delete()

        # TODO: for some reason, `Monitor` insists on being updated outside of the transaction, even
        # though it's also not region siloed?
        merge_users_for_model_in_org(
            Monitor,
            organization_id=organization_id,
            from_user_id=from_user_id,
            to_user_id=to_user_id,
        )

    def reset_idp_flags(self, *, organization_id: int) -> None:
        with unguarded_write(using=router.db_for_write(OrganizationMember)):
            # Flags are not replicated -- these updates are safe without outbox application.
            OrganizationMember.objects.filter(
                organization_id=organization_id,
                flags=models.F("flags").bitor(OrganizationMember.flags["idp:provisioned"]),
            ).update(
                flags=models.F("flags")
                .bitand(~OrganizationMember.flags["idp:provisioned"])
                .bitand(~OrganizationMember.flags["idp:role-restricted"])
            )

        with unguarded_write(using=router.db_for_write(Team)):
            Team.objects.filter(organization_id=organization_id).update(idp_provisioned=False)

    def update_region_user(self, *, user: RpcRegionUser, region_name: str) -> None:
        # Normally, calling update on a QS for organization member fails because we need to ensure that updates to
        # OrganizationMember objects produces outboxes.  In this case, it is safe to do the update directly because
        # the attribute we are changing never needs to produce an outbox.
        with unguarded_write(using=router.db_for_write(OrganizationMember)):
            OrganizationMember.objects.filter(user_id=user.id).update(
                user_is_active=user.is_active, user_email=user.email
            )

    def get_option(self, *, organization_id: int, key: str) -> OptionValue:
        orm_organization = Organization.objects.get_from_cache(id=organization_id)
        value = orm_organization.get_option(key)
        if value is not None and not isinstance(value, (str, int, bool)):
            raise TypeError
        return value

    def update_option(self, *, organization_id: int, key: str, value: OptionValue) -> bool:
        orm_organization = Organization.objects.get_from_cache(id=organization_id)
        return orm_organization.update_option(key, value)

    def delete_option(self, *, organization_id: int, key: str) -> None:
        orm_organization = Organization.objects.get_from_cache(id=organization_id)
        orm_organization.delete_option(key)

    def send_sso_link_emails(
        self, *, organization_id: int, sending_user_email: str, provider_key: str
    ) -> None:
        from sentry.auth import manager
        from sentry.auth.exceptions import ProviderNotRegistered

        try:
            provider = manager.get(provider_key)
        except ProviderNotRegistered as e:
            logger.warning("Could not send SSO link emails: %s", e)
            return

        member_list = OrganizationMember.objects.filter(
            organization_id=organization_id,
            flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"]),
        ).select_related("organization")

        provider = manager.get(provider_key)
        for member in member_list:
            member.send_sso_link_email(sending_user_email, provider)

    def send_sso_unlink_emails(
        self, *, organization_id: int, sending_user_email: str, provider_key: str
    ) -> None:
        from sentry.auth import manager
        from sentry.auth.exceptions import ProviderNotRegistered

        try:
            manager.get(provider_key)
        except ProviderNotRegistered as e:
            logger.warning("Could not send SSO unlink emails: %s", e)
            return

        email_unlink_notifications.delay(
            org_id=organization_id, sending_user_email=sending_user_email, provider_key=provider_key
        )

    def count_members_without_sso(self, *, organization_id: int) -> int:
        return OrganizationMember.objects.filter(
            organization_id=organization_id,
            flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"]),
        ).count()

    def delete_organization(
        self, *, organization_id: int, user: RpcUser
    ) -> RpcOrganizationDeleteResponse:
        orm_organization = Organization.objects.get(id=organization_id)
        if orm_organization.is_default:
            return RpcOrganizationDeleteResponse(
                response_state=RpcOrganizationDeleteState.CANNOT_REMOVE_DEFAULT_ORG
            )

        published_sentry_apps = app_service.get_published_sentry_apps_for_organization(
            organization_id=orm_organization.id
        )

        if len(published_sentry_apps) > 0:
            return RpcOrganizationDeleteResponse(
                response_state=RpcOrganizationDeleteState.OWNS_PUBLISHED_INTEGRATION
            )

        with transaction.atomic(router.db_for_write(RegionScheduledDeletion)):
            updated_organization = mark_organization_as_pending_deletion_with_outbox_message(
                org_id=orm_organization.id
            )

            if updated_organization is not None:
                schedule = RegionScheduledDeletion.schedule(orm_organization, days=1, actor=user)

                Organization.objects.uncache_object(updated_organization.id)
                return RpcOrganizationDeleteResponse(
                    response_state=RpcOrganizationDeleteState.PENDING_DELETION,
                    updated_organization=serialize_rpc_organization(updated_organization),
                    schedule_guid=schedule.guid,
                )
        return RpcOrganizationDeleteResponse(response_state=RpcOrganizationDeleteState.NO_OP)

    def create_org_delete_log(
        self, *, organization_id: int, audit_log_actor: RpcAuditLogEntryActor
    ) -> None:
        create_org_delete_log(organization_id=organization_id, audit_log_actor=audit_log_actor)

    def send_signal(
        self,
        *,
        organization_id: int,
        signal: RpcOrganizationSignal,
        args: Mapping[str, str | int | None],
    ) -> None:
        signal.signal.send_robust(None, organization_id=organization_id, **args)

    def get_organization_owner_members(
        self, *, organization_id: int
    ) -> list[RpcOrganizationMember]:
        org: Organization = Organization.objects.get(id=organization_id)
        owner_members = org.get_members_with_org_roles(roles=[roles.get_top_dog().id])

        return list(map(serialize_member, owner_members))


class ControlOrganizationCheckService(OrganizationCheckService):
    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> int | None:
        # See RegionOrganizationCheckService below
        try:
            org = OrganizationMapping.objects.get(slug=slug)
            if only_visible and org.status != OrganizationStatus.ACTIVE:
                raise OrganizationMapping.DoesNotExist
            return org.organization_id
        except OrganizationMapping.DoesNotExist:
            logger.info("OrganizationMapping by slug [%s] not found", slug)

        return None

    def check_organization_by_id(self, *, id: int, only_visible: bool) -> bool:
        # See RegionOrganizationCheckService below
        org_mapping = OrganizationMapping.objects.filter(organization_id=id).first()
        if org_mapping is None:
            return False
        if only_visible and org_mapping.status != OrganizationStatus.ACTIVE:
            return False
        return True


class RegionOrganizationCheckService(OrganizationCheckService):
    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> int | None:
        # See ControlOrganizationCheckService above
        try:
            org = Organization.objects.get_from_cache(slug=slug)
            if only_visible and org.status != OrganizationStatus.ACTIVE:
                raise Organization.DoesNotExist
            return org.id
        except Organization.DoesNotExist:
            logger.info("Organization by slug [%s] not found", slug)

        return None

    def check_organization_by_id(self, *, id: int, only_visible: bool) -> bool:
        # See ControlOrganizationCheckService above
        try:
            org = Organization.objects.get_from_cache(id=id)
            if only_visible and org.status != OrganizationStatus.ACTIVE:
                raise Organization.DoesNotExist
            return True
        except Organization.DoesNotExist:
            pass

        return False


class OutboxBackedOrganizationSignalService(OrganizationSignalService):
    def schedule_signal(
        self, signal: Signal, organization_id: int, args: Mapping[str, str | int | None]
    ) -> None:
        with outbox_context(flush=False):
            payload: Any = {
                "args": args,
                "signal": int(RpcOrganizationSignal.from_signal(signal)),
            }
            for region_name in find_regions_for_orgs([organization_id]):
                ControlOutbox(
                    shard_scope=OutboxScope.ORGANIZATION_SCOPE,
                    shard_identifier=organization_id,
                    region_name=region_name,
                    category=OutboxCategory.SEND_SIGNAL,
                    object_identifier=ControlOutbox.next_object_identifier(),
                    payload=payload,
                ).save()


class OnCommitBackedOrganizationSignalService(OrganizationSignalService):
    def schedule_signal(
        self, signal: Signal, organization_id: int, args: Mapping[str, int | str | None]
    ) -> None:
        _signal = RpcOrganizationSignal.from_signal(signal)
        transaction.on_commit(
            lambda: DatabaseBackedOrganizationService().send_signal(
                organization_id=organization_id,
                signal=_signal,
                args=args,
            ),
            router.db_for_write(Organization),
        )
