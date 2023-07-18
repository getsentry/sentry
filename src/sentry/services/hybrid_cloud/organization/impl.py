from __future__ import annotations

from typing import Any, Iterable, List, Mapping, Optional, Set, Union, cast

from django.db import IntegrityError, models, router, transaction
from django.dispatch import Signal

from sentry import roles
from sentry.api.serializers import serialize
from sentry.models import (
    Activity,
    ControlOutbox,
    GroupAssignee,
    GroupBookmark,
    GroupSeen,
    GroupShare,
    GroupSubscription,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    OutboxCategory,
    OutboxScope,
    Team,
    outbox_context,
)
from sentry.models.organizationmember import InviteStatus
from sentry.services.hybrid_cloud import OptionValue, logger
from sentry.services.hybrid_cloud.organization import (
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
    RpcUserInviteContext,
    RpcUserOrganizationContext,
)
from sentry.services.hybrid_cloud.organization.serial import (
    serialize_member,
    serialize_organization_summary,
    serialize_rpc_organization,
)
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.util import flags_to_bits
from sentry.silo import unguarded_write
from sentry.types.region import find_regions_for_orgs


class DatabaseBackedOrganizationService(OrganizationService):
    def check_membership_by_id(
        self, organization_id: int, user_id: int
    ) -> Optional[RpcOrganizationMember]:
        from sentry.auth.access import get_cached_organization_member

        try:
            member = get_cached_organization_member(
                user_id=user_id, organization_id=organization_id
            )
        except OrganizationMember.DoesNotExist:
            return None

        return serialize_member(member)

    def serialize_organization(
        self, *, id: int, as_user: Optional[RpcUser] = None
    ) -> Optional[Any]:
        org = Organization.objects.filter(id=id).first()
        if org is None:
            return None
        return serialize(org, user=as_user)

    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int] = None, slug: Optional[str] = None
    ) -> Optional[RpcUserOrganizationContext]:
        membership: Optional[RpcOrganizationMember] = None
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
            user_id=user_id, organization=serialize_rpc_organization(org), member=membership
        )

    def get_org_by_slug(
        self,
        *,
        slug: str,
        user_id: Optional[int] = None,
    ) -> Optional[RpcOrganizationSummary]:
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

    def get_default_organization(self) -> RpcOrganization:
        return serialize_rpc_organization(Organization.get_default())

    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[RpcOrganizationMember]:
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
        organization_member_id: Optional[int] = None,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> Optional[RpcUserInviteContext]:
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
        organization_member_id: Optional[int] = None,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> Optional[RpcUserInviteContext]:
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
        organization_member_id: Optional[int] = None,
        org: Organization,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> Optional[RpcUserInviteContext]:
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
    ) -> Optional[RpcOrganizationMember]:
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

    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> Optional[int]:
        try:
            org = Organization.objects.get_from_cache(slug=slug)
            if only_visible and org.status != OrganizationStatus.ACTIVE:
                raise Organization.DoesNotExist
            return cast(int, org.id)
        except Organization.DoesNotExist:
            logger.info("Organization by slug [%s] not found", slug)

        return None

    def _query_organizations(
        self, user_id: int, scope: Optional[str], only_visible: bool
    ) -> List[Organization]:
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
        updates: models.F | models.CombinedExpression = models.F("flags")
        for (name, value) in flags.items():
            if value is True:
                updates = updates.bitor(getattr(Organization.flags, name))
            elif value is False:
                updates = updates.bitand(~getattr(Organization.flags, name))
            else:
                raise TypeError(f"Invalid value received for update_flags: {name}={value!r}")

        with outbox_context(transaction.atomic(router.db_for_write(Organization))):
            Organization.objects.filter(id=organization_id).update(flags=updates)
            Organization.outbox_for_update(org_id=organization_id).save()

    @staticmethod
    def _deserialize_member_flags(flags: RpcOrganizationMemberFlags) -> int:
        return flags_to_bits(
            flags.sso__linked,
            flags.sso__invalid,
            flags.member_limit__restricted,
            flags.idp__provisioned,
            flags.idp__role_restricted,
        )

    def add_organization_member(
        self,
        *,
        organization_id: int,
        default_org_role: str,
        user_id: int | None = None,
        email: str | None = None,
        flags: Optional[RpcOrganizationMemberFlags] = None,
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
            org_member: Optional[OrganizationMember] = None
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

    def add_team_member(self, *, team_id: int, organization_member: RpcOrganizationMember) -> None:
        OrganizationMemberTeam.objects.create(
            team_id=team_id, organizationmember_id=organization_member.id
        )
        # It might be nice to return an RpcTeamMember to represent what we just
        # created, but doing so would require a list of project IDs. We can implement
        # that if a return value is needed in the future.

    def get_team_members(self, *, team_id: int) -> Iterable[RpcOrganizationMember]:
        team_members = OrganizationMemberTeam.objects.filter(team_id=team_id)
        return [serialize_member(team_member.organizationmember) for team_member in team_members]

    def update_membership_flags(self, *, organization_member: RpcOrganizationMember) -> None:
        model = OrganizationMember.objects.get(id=organization_member.id)
        model.flags = self._deserialize_member_flags(organization_member.flags)
        model.save()

    @classmethod
    def _serialize_invite(cls, om: OrganizationMember) -> RpcOrganizationInvite:
        return RpcOrganizationInvite(id=om.id, token=om.token, email=om.email)

    def get_all_org_roles(
        self,
        organization_member: Optional[RpcOrganizationMember] = None,
        member_id: Optional[int] = None,
    ) -> List[str]:
        if member_id:
            member = OrganizationMember.objects.get(id=member_id)
            organization_member = serialize_member(member)

        org_roles: List[str] = []
        if organization_member:
            team_ids = [mt.team_id for mt in organization_member.member_teams]
            all_roles: Set[str] = set(
                Team.objects.filter(id__in=team_ids)
                .exclude(org_role=None)
                .values_list("org_role", flat=True)
            )
            all_roles.add(organization_member.role)
            org_roles.extend(list(all_roles))
        return org_roles

    def get_top_dog_team_member_ids(self, organization_id: int) -> List[int]:
        owner_teams = list(
            Team.objects.filter(
                organization_id=organization_id, org_role=roles.get_top_dog().id
            ).values_list("id", flat=True)
        )
        return list(
            OrganizationMemberTeam.objects.filter(team_id__in=owner_teams).values_list(
                "organizationmember_id", flat=True
            )
        )

    def update_default_role(self, *, organization_id: int, default_role: str) -> RpcOrganization:
        org = Organization.objects.get(id=organization_id)
        org.default_role = default_role
        org.save()
        return serialize_rpc_organization(org)

    def remove_user(self, *, organization_id: int, user_id: int) -> Optional[RpcOrganizationMember]:
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
        to_member: Optional[OrganizationMember] = OrganizationMember.objects.filter(
            organization_id=organization_id, user_id=to_user_id
        ).first()

        from_member: Optional[OrganizationMember] = OrganizationMember.objects.filter(
            organization_id=organization_id, user_id=from_user_id
        ).first()

        if from_member is None:
            return

        if to_member is None:
            to_member = OrganizationMember.objects.create(
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

        for team in from_member.teams.all():
            try:
                with transaction.atomic(router.db_for_write(OrganizationMemberTeam)):
                    OrganizationMemberTeam.objects.create(organizationmember=to_member, team=team)
            except IntegrityError:
                pass

        model_list = (
            GroupAssignee,
            GroupBookmark,
            GroupSeen,
            GroupShare,
            GroupSubscription,
            Activity,
        )

        for model in model_list:
            for obj in model.objects.filter(
                user_id=from_user_id, project__organization_id=organization_id
            ):
                try:
                    with transaction.atomic(router.db_for_write(model)):
                        obj.update(user_id=to_user_id)
                except IntegrityError:
                    pass

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

    def send_signal(
        self,
        *,
        organization_id: int,
        signal: RpcOrganizationSignal,
        args: Mapping[str, str | int | None],
    ) -> None:
        signal.signal.send_robust(None, organization_id=organization_id, **args)


class OutboxBackedOrganizationSignalService(OrganizationSignalService):
    def schedule_signal(
        self, signal: Signal, organization_id: int, args: Mapping[str, Optional[Union[str, int]]]
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
