from __future__ import annotations

from collections.abc import Iterable
from typing import Any, ClassVar

from django.db import connections, models, router

from sentry import features, roles
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedAutoField,
    BoundedBigIntegerField,
    FlexibleForeignKey,
    Model,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.roles import team_roles
from sentry.roles.manager import TeamRole

MAX_RESERVED_IDS = 100_000


def _reserve_ids(model: type[Model], count: int, using: str) -> list[int]:
    """Claim `count` values from the model's primary key sequence ahead of insert.

    Sequences are per-database, so `using` must be where the rows are written —
    drawing from another hands out ids that are already taken.
    """
    if not 1 <= count <= MAX_RESERVED_IDS:
        raise ValueError(f"Cannot reserve {count} ids, expected 1 to {MAX_RESERVED_IDS}.")

    with connections[using].cursor() as cursor:
        cursor.execute(
            "SELECT nextval(%s) FROM generate_series(1,%s);",
            [f"{model._meta.db_table}_id_seq", count],
        )
        return [row_id for (row_id,) in cursor.fetchall()]


class OrganizationMemberTeamQuerySet(BaseQuerySet["OrganizationMemberTeam"]):
    """Keeps `new_id` equal to `id` on bulk inserts.

    This lives on the queryset rather than the manager because not every bulk insert
    goes through `objects`: adding a team via a member's `teams` accessor, or any
    `.using(...)` call, reaches the queryset directly.
    """

    def bulk_create(
        self, objs: Iterable[OrganizationMemberTeam], *args: Any, **kwds: Any
    ) -> list[OrganizationMemberTeam]:
        rows = list[OrganizationMemberTeam](objs)
        if not rows:
            return super().bulk_create(rows, *args, **kwds)

        # `self.db` would give the read database here.
        using = self._db  # type: ignore[attr-defined]
        if using is None:
            using = router.db_for_write(self.model, **self._hints)  # type: ignore[attr-defined]

        # Claim the pks up front so `new_id` can be written in the same INSERT.
        rows_with_ids = zip(rows, _reserve_ids(self.model, len(rows), using))
        for row, row_id in rows_with_ids:
            row.id = row_id
            row.new_id = row_id
        return super().bulk_create(rows, *args, **kwds)


OrganizationMemberTeamManager = BaseManager.from_queryset(
    OrganizationMemberTeamQuerySet, "OrganizationMemberTeamManager"
)


@cell_silo_model
class OrganizationMemberTeam(Model):
    """
    Identifies relationships between organization members and the teams they are on.
    """

    objects: ClassVar[BaseManager[OrganizationMemberTeam]] = OrganizationMemberTeamManager()

    __relocation_scope__ = RelocationScope.Organization

    id = BoundedAutoField(primary_key=True)
    # Shadow column for the in-progress widening of `id` to int8. Writing it as rows are
    # inserted keeps new rows in step, so a one-off backfill only has to cover rows
    # predating the deploy; it is swapped into the primary key once backfilled.
    new_id = BoundedBigIntegerField(null=True)
    team = FlexibleForeignKey("sentry.Team")
    organizationmember = FlexibleForeignKey("sentry.OrganizationMember")
    # an inactive membership simply removes the team from the default list
    # but still allows them to re-join without request
    is_active = models.BooleanField(db_default=True)
    role = models.CharField(max_length=32, null=True, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmember_teams"
        unique_together = (("team", "organizationmember"),)

    __repr__ = sane_repr("team_id", "organizationmember_id")

    def save(self, **kwds: Any) -> None:
        if self.id is None:
            # Claim the pk up front so `new_id` can be written in the same INSERT.
            using = kwds.get("using")
            if using is None:
                using = router.db_for_write(type(self), instance=self)
            self.id = _reserve_ids(type(self), 1, using)[0]
            self.new_id = self.id
            # A freshly claimed pk cannot already exist, so skip the UPDATE probe
            # Django would otherwise run before inserting.
            kwds["force_insert"] = True
        super().save(**kwds)

    def get_audit_log_data(self) -> dict[str, Any]:
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
