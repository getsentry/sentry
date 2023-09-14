from django.db import router, transaction

from sentry.db.postgres.transactions import enforce_constraints
from sentry.models import AuthIdentityReplica, AuthProviderReplica, Organization
from sentry.models.teamreplica import TeamReplica
from sentry.services.hybrid_cloud.auth import RpcAuthIdentity, RpcAuthProvider
from sentry.services.hybrid_cloud.organization import RpcTeam
from sentry.services.hybrid_cloud.replica.service import ControlReplicaService, RegionReplicaService


class DatabaseBackedRegionReplicaService(RegionReplicaService):
    def upsert_replicated_auth_provider(
        self, *, auth_provider: RpcAuthProvider, region_name: str
    ) -> None:
        try:
            with enforce_constraints(transaction.atomic(router.db_for_write(AuthProviderReplica))):
                organization = Organization.objects.get(id=auth_provider.organization_id)
                # Deletes do not cascade immediately -- if we removed and add a new provider
                # we should just clear that older provider.
                AuthProviderReplica.objects.filter(organization=organization).exclude(
                    auth_provider_id=auth_provider.id
                ).delete()
                existing = AuthProviderReplica.objects.filter(
                    auth_provider_id=auth_provider.id
                ).first()
                update = {
                    "organization": organization,
                    "provider": auth_provider.provider,
                    "config": auth_provider.config,
                    "default_role": auth_provider.default_role,
                    "default_global_access": auth_provider.default_global_access,
                    "allow_unlinked": auth_provider.flags.allow_unlinked,
                    "scim_enabled": auth_provider.flags.scim_enabled,
                }

                if not existing:
                    AuthProviderReplica.objects.create(auth_provider_id=auth_provider.id, **update)
                    return

                existing.update(**update)
        except Organization.DoesNotExist:
            return

    def upsert_replicated_auth_identity(
        self, *, auth_identity: RpcAuthIdentity, region_name: str
    ) -> None:
        with enforce_constraints(transaction.atomic(router.db_for_write(AuthIdentityReplica))):
            # Since coalesced outboxes won't replicate the precise ordering of changes, these
            # unique keys can cause a deadlock in updates.  To address this, we just delete
            # any conflicting items and allow future outboxes to carry the updates
            # for the auth identities that should follow (given they will share the same shard).
            AuthIdentityReplica.objects.filter(
                ident=auth_identity.ident,
                auth_provider_id=auth_identity.auth_provider_id,
            ).exclude(auth_identity_id=auth_identity.id).delete()
            AuthIdentityReplica.objects.filter(
                user_id=auth_identity.user_id,
                auth_provider_id=auth_identity.auth_provider_id,
            ).exclude(auth_identity_id=auth_identity.id).delete()

            existing = AuthIdentityReplica.objects.filter(auth_identity_id=auth_identity.id).first()
            update = {
                "user_id": auth_identity.user_id,
                "auth_provider_id": auth_identity.auth_provider_id,
                "ident": auth_identity.ident,
                "data": auth_identity.data,
                "last_verified": auth_identity.last_verified,
            }

            if not existing:
                AuthIdentityReplica.objects.create(auth_identity_id=auth_identity.id, **update)
                return

            existing.update(**update)


class DatabaseBackedControlReplicaService(ControlReplicaService):
    def upsert_replicated_team(self, *, team: RpcTeam) -> None:
        with enforce_constraints(transaction.atomic(router.db_for_write(TeamReplica))):
            # Handle unique index -- since TEAM_UPDATEs use the Organization scope, this is safe.
            TeamReplica.objects.filter(
                organization_id=team.organization_id, slug=team.slug
            ).delete()

            TeamReplica.objects.create_or_update(
                team_id=team.id,
                values=dict(
                    organization_id=team.organization_id,
                    slug=team.slug,
                    name=team.name,
                    status=team.status,
                    org_role=team.org_role,
                ),
            )
