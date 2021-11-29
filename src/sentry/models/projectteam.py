from typing import TYPE_CHECKING, Sequence

from django.db.models.signals import post_delete, post_save

from sentry.constants import ObjectStatus
from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr
from sentry.tasks.code_owners import update_code_owners_schema

if TYPE_CHECKING:
    from sentry.models import Team

# TODO(dcramer): pull in enum library
ProjectStatus = ObjectStatus


class ProjectTeamManager(BaseManager):
    def get_for_teams_with_org_cache(self, teams: Sequence["Team"]) -> Sequence["ProjectTeam"]:
        project_teams = (
            self.filter(team__in=teams, project__status=ProjectStatus.VISIBLE)
            .order_by("project__name", "project__slug")
            .select_related("project")
        )

        # TODO(dcramer): we should query in bulk for ones we're missing here
        orgs = {i.organization_id: i.organization for i in teams}

        for project_team in project_teams:
            project_team.project.set_cached_field_value(
                "organization", orgs[project_team.project.organization_id]
            )

        return project_teams


class ProjectTeam(Model):
    __include_in_export__ = True

    project = FlexibleForeignKey("sentry.Project")
    team = FlexibleForeignKey("sentry.Team")

    objects = ProjectTeamManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectteam"
        unique_together = (("project", "team"),)

    __repr__ = sane_repr("project_id", "team_id")


post_save.connect(
    lambda instance, **kwargs: update_code_owners_schema.apply_async(
        kwargs={
            "organization": instance.project.organization,
            "projects": [instance.project],
        }
    ),
    sender=ProjectTeam,
    weak=False,
)
post_delete.connect(
    lambda instance, **kwargs: update_code_owners_schema.apply_async(
        kwargs={
            "organization": instance.project.organization,
            "projects": [instance.project],
        }
    ),
    sender=ProjectTeam,
    weak=False,
)
