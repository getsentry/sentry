from __future__ import annotations

from typing import Any

from django.db import models, router, transaction
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.fields import JSONField
from sentry.db.models.fields.bounded import BoundedBigIntegerField, BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.dashboard_widget import TypesClass


class ExploreSavedQueryDataset(TypesClass):
    SPANS = 0
    OURLOGS = 1

    TYPES = [
        (SPANS, "spans"),
        (OURLOGS, "ourlogs"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


@region_silo_model
class ExploreSavedQueryProject(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    explore_saved_query = FlexibleForeignKey("explore.ExploreSavedQuery")

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedqueryproject"
        unique_together = (("project", "explore_saved_query"),)


@region_silo_model
class ExploreSavedQuery(Model):
    """
    A saved Explore query
    """

    __relocation_scope__ = RelocationScope.Excluded

    projects = models.ManyToManyField("sentry.Project", through=ExploreSavedQueryProject)
    organization = FlexibleForeignKey("sentry.Organization")
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    name = models.CharField(max_length=255)
    query: models.Field[dict[str, Any], dict[str, Any]] = JSONField()
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    dataset = BoundedPositiveIntegerField(
        choices=ExploreSavedQueryDataset.as_choices(), default=ExploreSavedQueryDataset.SPANS
    )
    is_multi_query = models.BooleanField(default=False)

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedquery"

    __repr__ = sane_repr("organization_id", "created_by_id", "name")

    def set_projects(self, project_ids):
        with transaction.atomic(router.db_for_write(ExploreSavedQueryProject)):
            ExploreSavedQueryProject.objects.filter(explore_saved_query=self).exclude(
                project__in=project_ids
            ).delete()

            existing_project_ids = ExploreSavedQueryProject.objects.filter(
                explore_saved_query=self
            ).values_list("project", flat=True)

            new_project_ids = sorted(set(project_ids) - set(existing_project_ids))

            ExploreSavedQueryProject.objects.bulk_create(
                [
                    ExploreSavedQueryProject(project_id=project_id, explore_saved_query=self)
                    for project_id in new_project_ids
                ]
            )
