from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar, Self

from django.db import models

from sentry import features, roles
from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedAutoField, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.hybridcloud.models.outbox import RegionOutboxBase
from sentry.hybridcloud.outbox.base import RegionOutboxProducingManager, ReplicatedRegionModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.roles import team_roles
from sentry.roles.manager import TeamRole


@region_silo_model
class OrganizationMemberTeam(ReplicatedRegionModel):
    """
    Identifies relationships between organization members and the teams they are on.
    """

    objects: ClassVar[RegionOutboxProducingManager[Self]] = RegionOutboxProducingManager()

    __relocation_scope__ = RelocationScope.Organization
    category = OutboxCategory.ORGANIZATION_MEMBER_TEAM_UPDATE

    id = BoundedAutoField(primary_key=True)
    team = FlexibleForeignKey("sentry.Team")
    organizationmember = FlexibleForeignKey("sentry.OrganizationMember")
    # an inactive membership simply removes the team from the default list
    # but still allows them to re-join without request
    is_active = models.BooleanField(default=True)
    role = models.CharField(max_length=32, null=True, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmember_teams"
        unique_together = (("team", "organizationmember"),)

    __repr__ = sane_repr("team_id", "organizationmember_id")

    def outbox_for_update(self, shard_identifier: int | None = None) -> RegionOutboxBase:
        return super().outbox_for_update(
            shard_identifier=(
                self.organizationmember.organization_id
                if shard_identifier is None
                else shard_identifier
            )
        )

    def handle_async_replication(self, shard_identifier: int) -> None:
        from sentry.hybridcloud.services.replica.service import control_replica_service
        from sentry.organizations.services.organization.serial import (
            serialize_rpc_organization_member_team,
        )

        control_replica_service.upsert_replicated_organization_member_team(
            omt=serialize_rpc_organization_member_team(self)
        )

    @classmethod
    def handle_async_deletion(
        cls, identifier: int, shard_identifier: int, payload: Mapping[str, Any] | None
    ) -> None:
        from sentry.hybridcloud.services.replica.service import control_replica_service

        control_replica_service.remove_replicated_organization_member_team(
            organization_id=shard_identifier,
            organization_member_team_id=identifier,
        )

    def get_audit_log_data(self):
        return {
            "team_slug": self.team.slug,
            "member_id": self.organizationmember_id,
            "email": self.organizationmember.get_email(),
            "is_active": self.is_active,
        }

    def get_team_role(self) -> TeamRole:
        """Get this member's team-level role.

        If the role field is null, resolve to the minimum team role given by this
        member's organization role.
        """
        minimum_role = roles.get_minimum_team_role(self.organizationmember.role)

        if self.role and features.has(
            "organizations:team-roles", self.organizationmember.organization
        ):
            team_role = team_roles.get(self.role)
            if team_role.priority > minimum_role.priority:
                return team_role
        return minimum_role

    def get_scopes(self, team_roles_cache: dict[int, bool] | None = None) -> frozenset[str]:
        """Get the scopes belonging to this member's team-level role."""
        if team_roles_cache is None:
            team_roles_cache = {}
        if self.organizationmember.organization.id not in team_roles_cache:
            team_roles_cache[self.organizationmember.organization.id] = features.has(
                "organizations:team-roles", self.organizationmember.organization
            )
        has_team_roles = team_roles_cache.get(self.organizationmember.organization.id, False)
        if has_team_roles:
            return self.organizationmember.organization.get_scopes(self.get_team_role())
        return frozenset()
