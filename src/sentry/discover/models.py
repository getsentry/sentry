from __future__ import absolute_import

from django.db import models, transaction
from sentry.db.models.fields import JSONField
from sentry.db.models import Model, FlexibleForeignKey, sane_repr


class DiscoverSavedQueryProject(Model):
    __core__ = False

    project = FlexibleForeignKey("sentry.Project")
    discover_saved_query = FlexibleForeignKey("sentry.DiscoverSavedQuery")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_discoversavedqueryproject"
        unique_together = (("project", "discover_saved_query"),)


class DiscoverSavedQuery(Model):
    """
    A saved Discover query
    """

    __core__ = False

    projects = models.ManyToManyField("sentry.Project", through=DiscoverSavedQueryProject)
    organization = FlexibleForeignKey("sentry.Organization")
    created_by = FlexibleForeignKey("sentry.User", null=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=255)
    query = JSONField()
    version = models.IntegerField(null=True)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_discoversavedquery"

    __repr__ = sane_repr("organization_id", "created_by", "name")

    def set_projects(self, project_ids):
        with transaction.atomic():
            DiscoverSavedQueryProject.objects.filter(discover_saved_query=self).exclude(
                project__in=project_ids
            ).delete()

            existing_project_ids = DiscoverSavedQueryProject.objects.filter(
                discover_saved_query=self
            ).values_list("project", flat=True)

            new_project_ids = list(set(project_ids) - set(existing_project_ids))

            DiscoverSavedQueryProject.objects.bulk_create(
                [
                    DiscoverSavedQueryProject(project_id=project_id, discover_saved_query=self)
                    for project_id in new_project_ids
                ]
            )
