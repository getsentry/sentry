from typing import Any, Iterator, List, Mapping, Optional, Type, Union

from django.db import router, transaction
from django.db.models import Q

from sentry.db.models import BaseModel, FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.outboxes import ReplicatedControlModel, ReplicatedRegionModel
from sentry.db.postgres.transactions import enforce_constraints
from sentry.hybridcloud.models import ApiKeyReplica
from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.models import (
    ApiKey,
    AuthIdentity,
    AuthIdentityReplica,
    AuthProvider,
    AuthProviderReplica,
    Organization,
    OrganizationMemberTeam,
    OrganizationMemberTeamReplica,
    OrganizationSlugReservationReplica,
    OutboxCategory,
    Team,
    User,
)
from sentry.models.teamreplica import TeamReplica
from sentry.services.hybrid_cloud.auth import RpcApiKey, RpcAuthIdentity, RpcAuthProvider
from sentry.services.hybrid_cloud.organization import RpcOrganizationMemberTeam, RpcTeam
from sentry.services.hybrid_cloud.replica.service import ControlReplicaService, RegionReplicaService


def get_foreign_key_columns(
    destination: BaseModel,
    *source_models: Type[BaseModel],
) -> Iterator[str]:
    destination_model: Type[BaseModel] = type(destination)
    found_one = False
    for field in destination_model._meta.get_fields():
        if isinstance(field, HybridCloudForeignKey):
            if field.foreign_model in source_models:
                yield field.name
                found_one = True
        elif isinstance(field, FlexibleForeignKey):
            if field.related_model in source_models:
                yield field.name
                found_one = True

    if not found_one:
        raise TypeError(
            f"replication to {destination_model} lacking required HybridCloudForeignKey to {source_models}"
        )


def get_foreign_key_column(
    destination: BaseModel,
    source_model: Type[BaseModel],
) -> str:
    return next(get_foreign_key_columns(destination, source_model))


def get_conflicting_unique_columns(
    destination: BaseModel,
    fk: str,
    category: OutboxCategory,
) -> Iterator[List[str]]:
    destination_model: Type[BaseModel] = type(destination)

    uniques = list(destination_model._meta.unique_together) + [
        (field.name,)
        for field in destination_model._meta.get_fields()
        if getattr(field, "unique", False) and not getattr(field, "primary_key", False)
    ]
    if not uniques:
        return

    scope = category.get_scope()
    scope_controlled_columns: List[str]
    if scope == scope.USER_SCOPE:
        scope_controlled_columns = [get_foreign_key_column(destination, User)]
    elif scope == scope.ORGANIZATION_SCOPE:
        scope_controlled_columns = list(
            get_foreign_key_columns(destination, Organization, AuthProvider)
        )
    else:
        raise TypeError(
            f"replication to {destination_model} includes unique index that is not scoped by shard!"
        )
    scope_controlled_columns.append(fk)

    for columns in uniques:
        if not any(c in columns for c in scope_controlled_columns):
            raise TypeError(
                f"replication to {destination_model} includes unique index that is not scoped by shard: {columns}!"
            )
        yield list(columns)


def handle_replication(
    source_model: Union[Type[ReplicatedControlModel], Type[ReplicatedRegionModel]],
    destination: BaseModel,
    fk: Optional[str] = None,
):
    category: OutboxCategory = source_model.category
    destination_model: Type[BaseModel] = type(destination)
    fk = fk or get_foreign_key_column(destination, source_model)
    dest_filter: Mapping[str, Any] = {fk: getattr(destination, fk)}

    with enforce_constraints(transaction.atomic(router.db_for_write(destination_model))):
        for columns in get_conflicting_unique_columns(destination, fk, category):
            destination_model.objects.filter(
                **{c: getattr(destination, c) for c in columns}
            ).exclude(**dest_filter).delete()
        existing = destination_model.objects.filter(**dest_filter).first()
        if existing:
            update: Mapping[str, Any] = {
                field.name: getattr(destination, field.name)
                for field in destination_model._meta.get_fields()
                if field.editable and field.name not in ("id", "date_added")
            }
            existing.update(**update)
        else:
            destination.save()


class DatabaseBackedRegionReplicaService(RegionReplicaService):
    def upsert_replicated_auth_provider(
        self, *, auth_provider: RpcAuthProvider, region_name: str
    ) -> None:
        try:
            organization = Organization.objects.get(id=auth_provider.organization_id)
        except Organization.DoesNotExist:
            return

        destination = AuthProviderReplica(
            auth_provider_id=auth_provider.id,
            provider=auth_provider.provider,
            organization_id=organization.id,
            config=auth_provider.config,  # type: ignore
            default_role=auth_provider.default_role,
            default_global_access=auth_provider.default_global_access,
            allow_unlinked=auth_provider.flags.allow_unlinked,
            scim_enabled=auth_provider.flags.scim_enabled,
        )

        handle_replication(AuthProvider, destination)

    def upsert_replicated_auth_identity(
        self, *, auth_identity: RpcAuthIdentity, region_name: str
    ) -> None:

        destination = AuthIdentityReplica(
            auth_identity_id=auth_identity.id,
            user_id=auth_identity.user_id,
            auth_provider_id=auth_identity.auth_provider_id,
            ident=auth_identity.ident,
            data=auth_identity.data,  # type: ignore
            last_verified=auth_identity.last_verified,
        )

        handle_replication(AuthIdentity, destination)

    def upsert_replicated_api_key(self, *, api_key: RpcApiKey, region_name: str) -> None:
        try:
            organization = Organization.objects.get(id=api_key.organization_id)
        except Organization.DoesNotExist:
            return

        destination = ApiKeyReplica(
            apikey_id=api_key.id,
            organization_id=organization.id,
            label=api_key.label,
            key=api_key.key,
            status=api_key.status,
            allowed_origins="\n".join(api_key.allowed_origins),
            scope_list=api_key.scope_list,
        )

        handle_replication(ApiKey, destination)

    def upsert_replicated_org_slug_reservation(
        self, *, slug_reservation: RpcOrganizationSlugReservation, region_name: str
    ) -> None:
        with enforce_constraints(
            transaction.atomic(router.db_for_write(OrganizationSlugReservationReplica))
        ):
            # Delete any slug reservation that can possibly conflict, it's likely stale
            OrganizationSlugReservationReplica.objects.filter(
                Q(organization_slug_reservation_id=slug_reservation.id)
                | Q(
                    organization_id=slug_reservation.organization_id,
                    reservation_type=slug_reservation.reservation_type,
                )
                | Q(slug=slug_reservation.slug)
            ).delete()

            OrganizationSlugReservationReplica.objects.create(
                slug=slug_reservation.slug,
                organization_id=slug_reservation.organization_id,
                user_id=slug_reservation.user_id,
                region_name=slug_reservation.region_name,
                reservation_type=slug_reservation.reservation_type,
                organization_slug_reservation_id=slug_reservation.id,
            )

    def delete_replicated_org_slug_reservation(
        self, *, organization_slug_reservation_id: int, region_name: str
    ) -> None:
        with enforce_constraints(
            transaction.atomic(router.db_for_write(OrganizationSlugReservationReplica))
        ):
            org_slug_qs = OrganizationSlugReservationReplica.objects.filter(
                organization_slug_reservation_id=organization_slug_reservation_id
            )
            org_slug_qs.delete()


class DatabaseBackedControlReplicaService(ControlReplicaService):
    def remove_replicated_organization_member_team(
        self, *, organization_id: int, organization_member_team_id: int
    ) -> None:
        OrganizationMemberTeamReplica.objects.filter(
            organization_id=organization_id, organizationmemberteam_id=organization_member_team_id
        ).delete()

    def upsert_replicated_organization_member_team(self, *, omt: RpcOrganizationMemberTeam) -> None:
        destination = OrganizationMemberTeamReplica(
            team_id=omt.team_id,
            role=omt.role,
            organization_id=omt.organization_id,
            organizationmember_id=omt.organizationmember_id,
            organizationmemberteam_id=omt.id,
            is_active=omt.is_active,
        )

        handle_replication(OrganizationMemberTeam, destination, fk="organizationmemberteam_id")

    def upsert_replicated_team(self, *, team: RpcTeam) -> None:
        destination = TeamReplica(
            team_id=team.id,
            organization_id=team.organization_id,
            slug=team.slug,
            name=team.name,
            status=team.status,
            org_role=team.org_role,
        )

        handle_replication(Team, destination)
