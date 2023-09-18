from typing import Any, Iterator, List, Mapping, Type, Union

from django.db import router, transaction

from sentry.db.models import BaseModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.outboxes import ReplicatedControlModel, ReplicatedRegionModel
from sentry.db.postgres.transactions import enforce_constraints
from sentry.models import (
    AuthIdentity,
    AuthIdentityReplica,
    AuthProvider,
    AuthProviderReplica,
    Organization,
    OrganizationMemberTeam,
    OrganizationMemberTeamReplica,
    OutboxCategory,
    Team,
    User,
)
from sentry.models.teamreplica import TeamReplica
from sentry.services.hybrid_cloud.auth import RpcAuthIdentity, RpcAuthProvider
from sentry.services.hybrid_cloud.organization import RpcOrganizationMemberTeam, RpcTeam
from sentry.services.hybrid_cloud.replica.service import ControlReplicaService, RegionReplicaService


def get_foreign_key_column(
    destination: BaseModel,
    *source_models: Type[BaseModel],
) -> str:
    destination_model: Type[BaseModel] = type(destination)
    for field in destination_model._meta.get_fields():
        if isinstance(field, HybridCloudForeignKey):
            if field.foreign_model in source_models:
                return field.name
    raise TypeError(
        f"replication to {destination_model} lacking required HybridCloudForeignKey to {source_models}"
    )


def get_conflicting_unique_columns(
    destination: BaseModel,
    category: OutboxCategory,
) -> Iterator[List[str]]:
    destination_model: Type[BaseModel] = type(destination)

    if not destination_model._meta.unique_together:
        return

    scope = category.get_scope()
    scope_controlled_column: str
    if scope == scope.USER_SCOPE:
        scope_controlled_column = get_foreign_key_column(destination, User)
    elif scope == scope.ORGANIZATION_SCOPE:
        scope_controlled_column = get_foreign_key_column(destination, Organization, AuthProvider)
    else:
        raise TypeError(
            f"replication to {destination_model} includes unique index that is not scoped by shard!"
        )

    for columns in destination_model._meta.unique_together:
        if scope_controlled_column not in columns:
            raise TypeError(
                f"replication to {destination_model} includes unique index that is not scoped by shard: {columns}!"
            )
        yield list(columns)


def handle_replication(
    source_model: Union[Type[ReplicatedControlModel], Type[ReplicatedRegionModel]],
    destination: BaseModel,
):
    category: OutboxCategory = source_model.category
    destination_model: Type[BaseModel] = type(destination)
    fk = get_foreign_key_column(destination, source_model)
    dest_filter: Mapping[str, Any] = {fk: getattr(destination, fk)}

    with enforce_constraints(transaction.atomic(router.db_for_write(destination_model))):
        for columns in get_conflicting_unique_columns(destination, category):
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


class DatabaseBackedControlReplicaService(ControlReplicaService):
    def upsert_replicated_organization_member_team(self, *, omt: RpcOrganizationMemberTeam) -> None:
        destination = OrganizationMemberTeamReplica(
            team_id=omt.team_id,
            role=omt.role,
            organization_id=omt.organization_id,
            organizationmember_id=omt.organizationmember_id,
            organizationmemberteam_id=omt.id,
            is_active=omt.is_active,
        )

        handle_replication(OrganizationMemberTeam, destination)

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
