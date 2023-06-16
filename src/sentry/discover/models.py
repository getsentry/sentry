from django.db import models, transaction
from django.db.models import Q, UniqueConstraint
from django.utils import timezone

from sentry import features, options
from sentry.db.models import (
    BaseManager,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields import JSONField
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.projectteam import ProjectTeam
from sentry.tasks.relay import schedule_invalidate_project_config

MAX_KEY_TRANSACTIONS = 10
MAX_TEAM_KEY_TRANSACTIONS = 100


@region_silo_only_model
class DiscoverSavedQueryProject(Model):
    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project")
    discover_saved_query = FlexibleForeignKey("sentry.DiscoverSavedQuery")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_discoversavedqueryproject"
        unique_together = (("project", "discover_saved_query"),)


@region_silo_only_model
class DiscoverSavedQuery(Model):
    """
    A saved Discover query
    """

    __include_in_export__ = False

    projects = models.ManyToManyField("sentry.Project", through=DiscoverSavedQueryProject)
    organization = FlexibleForeignKey("sentry.Organization")
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    name = models.CharField(max_length=255)
    query = JSONField()
    version = models.IntegerField(null=True)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    is_homepage = models.BooleanField(null=True, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_discoversavedquery"
        constraints = [
            UniqueConstraint(
                fields=["organization", "created_by_id", "is_homepage"],
                condition=Q(is_homepage=True),
                name="unique_user_homepage_query",
            )
        ]

    __repr__ = sane_repr("organization_id", "created_by_id", "name")

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


class TeamKeyTransactionModelManager(BaseManager):
    @staticmethod
    def __schedule_invalidate_project_config_transaction_commit(instance, trigger):
        try:
            project = getattr(instance.project_team, "project", None)
        except ProjectTeam.DoesNotExist:
            # During org deletions TeamKeyTransactions are cleaned up as a cascade
            # of ProjectTeam being deleted so this read can fail.
            return

        if project is None:
            return

        if features.has("organizations:dynamic-sampling", project.organization) and options.get(
            "dynamic-sampling:enabled-biases"
        ):
            from sentry.dynamic_sampling import RuleType, get_enabled_user_biases

            # check if option is enabled
            enabled_biases = get_enabled_user_biases(
                project.get_option("sentry:dynamic_sampling_biases", None)
            )
            # invalidate project config only when the rule is enabled
            if RuleType.BOOST_KEY_TRANSACTIONS_RULE.value in enabled_biases:
                schedule_invalidate_project_config(project_id=project.id, trigger=trigger)

    def post_save(self, instance, **kwargs):
        # this hook may be called from model hooks during an
        # open transaction. In that case, wait until the current transaction has
        # been committed or rolled back to ensure we don't read stale data in the
        # task.
        #
        # If there is no transaction open, on_commit should run immediately.
        self.__schedule_invalidate_project_config_transaction_commit(
            instance, "teamkeytransaction.post_save"
        )

    def post_delete(self, instance, **kwargs):
        # this hook may be called from model hooks during an
        # open transaction. In that case, wait until the current transaction has
        # been committed or rolled back to ensure we don't read stale data in the
        # task.
        #
        # If there is no transaction open, on_commit should run immediately.
        self.__schedule_invalidate_project_config_transaction_commit(
            instance, "teamkeytransaction.post_delete"
        )


@region_silo_only_model
class TeamKeyTransaction(Model):
    __include_in_export__ = False

    # max_length here is based on the maximum for transactions in relay
    transaction = models.CharField(max_length=200)
    project_team = FlexibleForeignKey("sentry.ProjectTeam", null=True, db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization")

    # Custom Model Manager required to override post_save/post_delete method
    objects = TeamKeyTransactionModelManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_performanceteamkeytransaction"
        unique_together = (("project_team", "transaction"),)
