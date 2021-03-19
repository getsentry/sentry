import warnings
from collections import defaultdict

from django.conf import settings
from django.db import connections, IntegrityError, models, router, transaction
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.app import env, locks
from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)
from sentry.db.models.utils import slugify_instance
from sentry.utils.retries import TimedRetryPolicy


class TeamManager(BaseManager):
    def get_for_user(self, organization, user, scope=None, with_projects=False):
        """
        Returns a list of all teams a user has some level of access to.
        """
        from sentry.auth.superuser import is_active_superuser
        from sentry.models import (
            OrganizationMemberTeam,
            Project,
            ProjectStatus,
            ProjectTeam,
            OrganizationMember,
        )

        if not user.is_authenticated():
            return []

        base_team_qs = self.filter(organization=organization, status=TeamStatus.VISIBLE)

        if env.request and is_active_superuser(env.request) or settings.SENTRY_PUBLIC:
            team_list = list(base_team_qs)
        else:
            try:
                om = OrganizationMember.objects.get(user=user, organization=organization)
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
                Project.objects.filter(teams__in=team_list, status=ProjectStatus.VISIBLE),
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


# TODO(dcramer): pull in enum library
class TeamStatus:
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class Team(Model):
    """
    A team represents a group of individuals which maintain ownership of projects.
    """

    __core__ = True

    organization = FlexibleForeignKey("sentry.Organization")
    slug = models.SlugField()
    name = models.CharField(max_length=64)
    status = BoundedPositiveIntegerField(
        choices=(
            (TeamStatus.VISIBLE, _("Active")),
            (TeamStatus.PENDING_DELETION, _("Pending Deletion")),
            (TeamStatus.DELETION_IN_PROGRESS, _("Deletion in Progress")),
        ),
        default=TeamStatus.VISIBLE,
    )
    actor = FlexibleForeignKey(
        "sentry.Actor", db_index=True, unique=True, null=True, on_delete=models.PROTECT
    )
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = TeamManager(cache_fields=("pk", "slug"))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_team"
        unique_together = (("organization", "slug"),)

    __repr__ = sane_repr("name", "slug")

    def __str__(self):
        return f"{self.name} ({self.slug})"

    def save(self, *args, **kwargs):
        if not self.slug:
            lock = locks.get("slug:team", duration=5)
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(self, self.name, organization=self.organization)
        super().save(*args, **kwargs)

    @property
    def member_set(self):
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
            cursor = connections[router.db_for_write(Team)].cursor()
            # we use a cursor here to avoid automatic cascading of relations
            # in Django
            try:
                cursor.execute("DELETE FROM sentry_team WHERE id = %s", [self.id])
            finally:
                cursor.close()

    def get_audit_log_data(self):
        return {"id": self.id, "slug": self.slug, "name": self.name, "status": self.status}
