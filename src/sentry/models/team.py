from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING, ClassVar

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db import models, router, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry.app import env
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.slug import SentrySlugField
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.utils import slugify_instance
from sentry.hybridcloud.outbox.base import ReplicatedRegionModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.locks import locks
from sentry.utils.retries import TimedRetryPolicy
from sentry.utils.snowflake import save_with_snowflake_id, snowflake_id_model

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser


class TeamManager(BaseManager["Team"]):
    def get_for_user(
        self,
        organization: Organization,
        user: User | RpcUser | AnonymousUser,
        scope: str | None = None,
        is_team_admin: bool = False,
    ) -> Sequence[Team]:
        """
        Returns a list of all teams a user has some level of access to.
        """
        from sentry.auth.superuser import is_active_superuser
        from sentry.models.organizationmember import OrganizationMember
        from sentry.models.organizationmemberteam import OrganizationMemberTeam

        if not user.is_authenticated:
            return []

        base_team_qs = self.filter(organization=organization, status=TeamStatus.ACTIVE)

        if env.request and is_active_superuser(env.request) or settings.SENTRY_PUBLIC:
            team_list = list(base_team_qs)
        else:
            try:
                om = OrganizationMember.objects.get(user_id=user.id, organization=organization)
            except OrganizationMember.DoesNotExist:
                # User is not a member of the organization at all
                return []

            # If a scope is passed through, make sure this scope is
            # available on the OrganizationMember object.
            if scope is not None and scope not in om.get_scopes():
                return []

            org_member_team_filter = OrganizationMemberTeam.objects.filter(
                organizationmember=om, is_active=True
            )
            if is_team_admin:
                org_member_team_filter = org_member_team_filter.filter(role="admin")

            team_list = list(base_team_qs.filter(id__in=org_member_team_filter.values_list("team")))

        return sorted(team_list, key=lambda x: x.name.lower())

    def post_save(self, *, instance: Team, created: bool, **kwargs: object) -> None:
        self.process_resource_change(instance, **kwargs)

    def post_delete(self, instance, **kwargs):
        self.process_resource_change(instance, **kwargs)

    def process_resource_change(self, instance, **kwargs):
        from sentry.models.organization import Organization
        from sentry.models.project import Project
        from sentry.tasks.codeowners import update_code_owners_schema

        def _spawn_task():
            try:
                update_code_owners_schema.apply_async(
                    kwargs={
                        "organization": instance.organization,
                        "projects": list(instance.get_projects()),
                    }
                )
            except (Organization.DoesNotExist, Project.DoesNotExist):
                pass

        transaction.on_commit(_spawn_task, router.db_for_write(Team))


# TODO(dcramer): pull in enum library
class TeamStatus:
    ACTIVE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


@snowflake_id_model
@region_silo_model
class Team(ReplicatedRegionModel):
    """
    A team represents a group of individuals which maintain ownership of projects.
    """

    __relocation_scope__ = RelocationScope.Organization
    category = OutboxCategory.TEAM_UPDATE

    organization = FlexibleForeignKey("sentry.Organization")
    slug = SentrySlugField()

    # Only currently used in SCIM, use slug elsewhere as this isn't updated in the app.
    # TODO: deprecate name in team API responses or keep it up to date with slug
    name = models.CharField(max_length=64)
    status = BoundedPositiveIntegerField(
        choices=(
            (TeamStatus.ACTIVE, _("Active")),
            (TeamStatus.PENDING_DELETION, _("Pending Deletion")),
            (TeamStatus.DELETION_IN_PROGRESS, _("Deletion in Progress")),
        ),
        default=TeamStatus.ACTIVE,
    )
    idp_provisioned = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects: ClassVar[TeamManager] = TeamManager(cache_fields=("pk", "slug"))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_team"
        unique_together = (("organization", "slug"),)

    __repr__ = sane_repr("name", "slug")

    def class_name(self):
        return "Team"

    def __str__(self):
        return f"{self.name} ({self.slug})"

    def handle_async_replication(self, shard_identifier: int) -> None:
        from sentry.hybridcloud.services.replica import control_replica_service
        from sentry.organizations.services.organization.serial import serialize_rpc_team

        control_replica_service.upsert_replicated_team(team=serialize_rpc_team(self))

    def save(self, *args, **kwargs):
        if not self.slug:
            lock = locks.get(f"slug:team:{self.organization_id}", duration=5, name="team_slug")
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(self, self.name, organization=self.organization)
        if settings.SENTRY_USE_SNOWFLAKE:
            snowflake_redis_key = "team_snowflake_key"
            save_with_snowflake_id(
                instance=self,
                snowflake_redis_key=snowflake_redis_key,
                save_callback=lambda: super(Team, self).save(*args, **kwargs),
            )
        else:
            super().save(*args, **kwargs)

    @property
    def member_set(self):
        """:returns a QuerySet of all Users that belong to this Team"""
        return self.organization.member_set.filter(
            organizationmemberteam__team=self,
            organizationmemberteam__is_active=True,
            user_id__isnull=False,
            user_is_active=True,
        ).distinct()

    def get_audit_log_data(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "status": self.status,
        }

    def get_projects(self):
        from sentry.models.project import Project

        return Project.objects.get_for_team_ids([self.id])

    def get_member_user_ids(self):
        return self.member_set.values_list("user_id", flat=True)
