from typing import TYPE_CHECKING, Sequence

from django.db import transaction
from django.db.models.signals import post_delete, post_save

from sentry.constants import ObjectStatus
from sentry.db.models import (
    BaseManager,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)

if TYPE_CHECKING:
    from sentry.models import Team


class ProjectTeamManager(BaseManager):
    def get_for_teams_with_org_cache(self, teams: Sequence["Team"]) -> Sequence["ProjectTeam"]:
        project_teams = (
            self.filter(team__in=teams, project__status=ObjectStatus.ACTIVE)
            .order_by("project__name", "project__slug")
            .select_related("project")
        )

        # TODO(dcramer): we should query in bulk for ones we're missing here
        orgs = {i.organization_id: i.organization for i in teams}

        for project_team in project_teams:
            if project_team.project.organization_id in orgs:
                project_team.project.set_cached_field_value(
                    "organization", orgs[project_team.project.organization_id]
                )

        return project_teams


@region_silo_only_model
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


def process_resource_change(instance, **kwargs):
    from sentry.models import Organization, Project
    from sentry.tasks.codeowners import update_code_owners_schema

    def _spawn_task():
        try:
            update_code_owners_schema.apply_async(
                kwargs={
                    "organization": instance.project.organization,
                    "projects": [instance.project],
                }
            )
        except (Project.DoesNotExist, Organization.DoesNotExist):
            pass

    transaction.on_commit(_spawn_task)


post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=ProjectTeam,
    weak=False,
)
post_delete.connect(
    lambda instance, **kwargs: process_resource_change(instance, **kwargs),
    sender=ProjectTeam,
    weak=False,
)
