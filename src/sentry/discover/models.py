from django.db import models, transaction
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.db.models.fields import JSONField
from sentry.db.models.fields.bounded import BoundedBigIntegerField

MAX_KEY_TRANSACTIONS = 10
MAX_TEAM_KEY_TRANSACTIONS = 100


class DiscoverSavedQueryProject(Model):
    __include_in_export__ = False

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

    __include_in_export__ = False

    projects = models.ManyToManyField("sentry.Project", through=DiscoverSavedQueryProject)
    organization = FlexibleForeignKey("sentry.Organization")
    created_by = FlexibleForeignKey("sentry.User", null=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=255)
    query = JSONField()
    version = models.IntegerField(null=True)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)

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


class TeamKeyTransaction(Model):
    __include_in_export__ = False

    # max_length here is based on the maximum for transactions in relay
    transaction = models.CharField(max_length=200)
    project_team = FlexibleForeignKey("sentry.ProjectTeam", null=True, db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_performanceteamkeytransaction"
        unique_together = (("project_team", "transaction"),)
