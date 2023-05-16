import warnings
from collections import defaultdict
from typing import TYPE_CHECKING, Optional, Sequence, Tuple, Union

from django.conf import settings
from django.db import IntegrityError, connections, models, router, transaction
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.app import env
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.utils import slugify_instance
from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.locks import locks
from sentry.models.actor import Actor
from sentry.models.outbox import OutboxCategory, OutboxScope, RegionOutbox
from sentry.utils.retries import TimedRetryPolicy
from sentry.utils.snowflake import SnowflakeIdMixin

if TYPE_CHECKING:
    from sentry.models import Organization, Project, User
    from sentry.services.hybrid_cloud.user import RpcUser


class TeamManager(BaseManager):
    def get_for_user(
        self,
        organization: "Organization",
        user: Union["User", "RpcUser"],
        scope: Optional[str] = None,
        with_projects: bool = False,
    ) -> Union[Sequence["Team"], Sequence[Tuple["Team", Sequence["Project"]]]]:
        """
        Returns a list of all teams a user has some level of access to.
        """
        from sentry.auth.superuser import is_active_superuser
        from sentry.models import OrganizationMember, OrganizationMemberTeam, Project, ProjectTeam

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

            team_list = list(
                base_team_qs.filter(
                    id__in=OrganizationMemberTeam.objects.filter(
                        organizationmember=om, is_active=True
                    ).values_list("team")
                )
            )

        results = sorted(team_list, key=lambda x: x.name.lower())

        if with_projects:
            project_list = sorted(
                Project.objects.filter(teams__in=team_list, status=ObjectStatus.ACTIVE),
                key=lambda x: x.name.lower(),
            )

            teams_by_project = defaultdict(set)
            for project_id, team_id in ProjectTeam.objects.filter(
                project__in=project_list, team__in=team_list
            ).values_list("project_id", "team_id"):
                teams_by_project[project_id].add(team_id)

            projects_by_team = {t.id: [] for t in team_list}
            for project in project_list:
                for team_id in teams_by_project[project.id]:
                    projects_by_team[team_id].append(project)

            # these kinds of queries make people sad :(
            for idx, team in enumerate(results):
                team_projects = projects_by_team[team.id]
                results[idx] = (team, team_projects)

        return results

    def post_save(self, instance, **kwargs):
        self.process_resource_change(instance, **kwargs)

    def post_delete(self, instance, **kwargs):
        self.process_resource_change(instance, **kwargs)

    def process_resource_change(self, instance, **kwargs):
        from sentry.models import Organization, Project
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

        transaction.on_commit(_spawn_task)


# TODO(dcramer): pull in enum library
class TeamStatus:
    ACTIVE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


@region_silo_only_model
class Team(Model, SnowflakeIdMixin):
    """
    A team represents a group of individuals which maintain ownership of projects.
    """

    __include_in_export__ = True

    organization = FlexibleForeignKey("sentry.Organization")
    slug = models.SlugField()

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
    actor = FlexibleForeignKey(
        "sentry.Actor",
        related_name="team_from_actor",
        db_index=True,
        unique=True,
        null=True,
    )
    idp_provisioned = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=timezone.now, null=True)
    org_role = models.CharField(max_length=32, null=True)

    objects = TeamManager(cache_fields=("pk", "slug"))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_team"
        unique_together = (("organization", "slug"),)

    __repr__ = sane_repr("name", "slug")

    def class_name(self):
        return "Team"

    def __str__(self):
        return f"{self.name} ({self.slug})"

    def save(self, *args, **kwargs):
        if not self.slug:
            lock = locks.get(f"slug:team:{self.organization_id}", duration=5, name="team_slug")
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(self, self.name, organization=self.organization)
        if settings.SENTRY_USE_SNOWFLAKE:
            snowflake_redis_key = "team_snowflake_key"
            self.save_with_snowflake_id(
                snowflake_redis_key, lambda: super(Team, self).save(*args, **kwargs)
            )
        else:
            super().save(*args, **kwargs)

    @property
    def member_set(self):
        """:returns a QuerySet of all Users that belong to this Team"""
        return self.organization.member_set.filter(
            organizationmemberteam__team=self,
            organizationmemberteam__is_active=True,
            user__is_active=True,
        ).distinct()

    def has_access(self, user, access=None):
        from sentry.models import AuthIdentity, OrganizationMember

        warnings.warn("Team.has_access is deprecated.", DeprecationWarning)

        queryset = self.member_set.filter(user=user)
        if access is not None:
            queryset = queryset.filter(type__lte=access)

        try:
            member = queryset.get()
        except OrganizationMember.DoesNotExist:
            return False

        try:
            auth_identity = AuthIdentity.objects.get(
                auth_provider__organization=self.organization_id, user=member.user_id
            )
        except AuthIdentity.DoesNotExist:
            return True

        return auth_identity.is_valid(member)

    def transfer_to(self, organization):
        """
        Transfers a team and all projects under it to the given organization.
        """
        from sentry.models import (
            OrganizationAccessRequest,
            OrganizationMember,
            OrganizationMemberTeam,
            Project,
            ProjectTeam,
            ReleaseProject,
            ReleaseProjectEnvironment,
        )

        try:
            with transaction.atomic():
                self.update(organization=organization)
        except IntegrityError:
            # likely this means a team already exists, let's try to coerce to
            # it instead of a blind transfer
            new_team = Team.objects.get(organization=organization, slug=self.slug)
        else:
            new_team = self

        project_ids = list(
            Project.objects.filter(teams=self)
            .exclude(organization=organization)
            .values_list("id", flat=True)
        )

        # remove associations with releases from other org
        ReleaseProject.objects.filter(project_id__in=project_ids).delete()
        ReleaseProjectEnvironment.objects.filter(project_id__in=project_ids).delete()

        Project.objects.filter(id__in=project_ids).update(organization=organization)

        ProjectTeam.objects.filter(project_id__in=project_ids).update(team=new_team)

        # remove any pending access requests from the old organization
        if self != new_team:
            OrganizationAccessRequest.objects.filter(team=self).delete()

        # identify shared members and ensure they retain team access
        # under the new organization
        old_memberships = OrganizationMember.objects.filter(teams=self).exclude(
            organization=organization
        )
        for member in old_memberships:
            try:
                new_member = OrganizationMember.objects.get(
                    user=member.user, organization=organization
                )
            except OrganizationMember.DoesNotExist:
                continue

            try:
                with transaction.atomic():
                    OrganizationMemberTeam.objects.create(
                        team=new_team, organizationmember=new_member
                    )
            except IntegrityError:
                pass

        OrganizationMemberTeam.objects.filter(team=self).exclude(
            organizationmember__organization=organization
        ).delete()

        if new_team != self:
            # Delete the old team
            cursor = connections[router.db_for_write(Team)].cursor()
            # we use a cursor here to avoid automatic cascading of relations
            # in Django
            try:
                with transaction.atomic(), in_test_psql_role_override("postgres"):
                    cursor.execute("DELETE FROM sentry_team WHERE id = %s", [self.id])
                    self.outbox_for_update().save()
                    cursor.execute("DELETE FROM sentry_actor WHERE team_id = %s", [new_team.id])
            finally:
                cursor.close()

            # Change whatever new_team's actor is to the one from the old team.
            with transaction.atomic():
                Actor.objects.filter(id=self.actor_id).update(team_id=new_team.id)
                new_team.actor_id = self.actor_id
                new_team.save()

    def get_audit_log_data(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "status": self.status,
            "org_role": self.org_role,
        }

    def get_projects(self):
        from sentry.models import Project

        return Project.objects.get_for_team_ids({self.id})

    def outbox_for_update(self) -> RegionOutbox:
        return RegionOutbox(
            shard_scope=OutboxScope.TEAM_SCOPE,
            shard_identifier=self.organization_id,
            category=OutboxCategory.TEAM_UPDATE,
            object_identifier=self.id,
        )

    def delete(self, **kwargs):
        from sentry.models import ExternalActor

        # There is no foreign key relationship so we have to manually delete the ExternalActors
        with transaction.atomic(), in_test_psql_role_override("postgres"):
            ExternalActor.objects.filter(actor_id=self.actor_id).delete()
            self.outbox_for_update().save()

            return super().delete(**kwargs)
