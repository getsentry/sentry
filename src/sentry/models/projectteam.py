from collections.abc import Sequence
from typing import TYPE_CHECKING, ClassVar

from django.db import router, transaction
from django.db.models import QuerySet
from django.db.models.signals import post_delete, post_save

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.manager.base import BaseManager

if TYPE_CHECKING:
    from sentry.models.team import Team


class ProjectTeamManager(BaseManager["ProjectTeam"]):
    def get_for_teams_with_org_cache(self, teams: Sequence["Team"]) -> QuerySet["ProjectTeam"]:
        return (
            self.filter(team__in=teams, project__status=ObjectStatus.ACTIVE)
            .order_by("project__name", "project__slug")
            .select_related("project", "project__organization")
        )


@region_silo_model
class ProjectTeam(Model):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project")
    team = FlexibleForeignKey("sentry.Team")

    objects: ClassVar[ProjectTeamManager] = ProjectTeamManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectteam"
        unique_together = (("project", "team"),)

    __repr__ = sane_repr("project_id", "team_id")


def process_resource_change(instance, **kwargs):
    from sentry.models.organization import Organization
    from sentry.models.project import Project
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

    transaction.on_commit(_spawn_task, router.db_for_write(ProjectTeam))


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
