from __future__ import annotations

from enum import Enum
from typing import Any, ClassVar

from django.db import models, router, transaction
from django.db.models import Q, UniqueConstraint
from django.utils import timezone

from sentry import features
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.fields import JSONField
from sentry.db.models.fields.bounded import BoundedBigIntegerField, BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.models.dashboard_widget import TypesClass
from sentry.models.projectteam import ProjectTeam
from sentry.tasks.relay import schedule_invalidate_project_config

MAX_KEY_TRANSACTIONS = 10
MAX_TEAM_KEY_TRANSACTIONS = 100


class DiscoverSavedQueryTypes(TypesClass):
    DISCOVER = 0
    ERROR_EVENTS = 1
    """
     Error side of the split from Discover.
    """
    TRANSACTION_LIKE = 2
    """
    This targets transaction-like data from the split from discover.
    """

    TYPES = [
        (DISCOVER, "discover"),
        (ERROR_EVENTS, "error-events"),
        (TRANSACTION_LIKE, "transaction-like"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class DatasetSourcesTypes(Enum):
    """
    Ambiguous queries that haven't been or couldn't be categorized into a
    specific dataset.
    """

    UNKNOWN = 0
    """
     Dataset inferred by either running the query or using heuristics.
    """
    INFERRED = 1
    """
     Canonical dataset, user explicitly selected it.
    """
    USER = 2
    """
     Was an ambiguous dataset forced to split (i.e. we picked a default).
    """
    FORCED = 3

    @classmethod
    def as_choices(cls):
        return tuple((source.value, source.name.lower()) for source in cls)


@region_silo_model
class DiscoverSavedQueryProject(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    discover_saved_query = FlexibleForeignKey("sentry.DiscoverSavedQuery")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_discoversavedqueryproject"
        unique_together = (("project", "discover_saved_query"),)


@region_silo_model
class DiscoverSavedQuery(Model):
    """
    A saved Discover query
    """

    __relocation_scope__ = RelocationScope.Excluded

    projects = models.ManyToManyField("sentry.Project", through=DiscoverSavedQueryProject)
    organization = FlexibleForeignKey("sentry.Organization")
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    name = models.CharField(max_length=255)
    query: models.Field[dict[str, Any], dict[str, Any]] = JSONField()
    version = models.IntegerField(null=True)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    is_homepage = models.BooleanField(null=True, blank=True)
    dataset = BoundedPositiveIntegerField(
        choices=DiscoverSavedQueryTypes.as_choices(), default=DiscoverSavedQueryTypes.DISCOVER
    )
    dataset_source = BoundedPositiveIntegerField(
        choices=DatasetSourcesTypes.as_choices(), default=DatasetSourcesTypes.UNKNOWN.value
    )

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
        with transaction.atomic(router.db_for_write(DiscoverSavedQueryProject)):
            DiscoverSavedQueryProject.objects.filter(discover_saved_query=self).exclude(
                project__in=project_ids
            ).delete()

            existing_project_ids = DiscoverSavedQueryProject.objects.filter(
                discover_saved_query=self
            ).values_list("project", flat=True)

            new_project_ids = sorted(set(project_ids) - set(existing_project_ids))

            DiscoverSavedQueryProject.objects.bulk_create(
                [
                    DiscoverSavedQueryProject(project_id=project_id, discover_saved_query=self)
                    for project_id in new_project_ids
                ]
            )


class TeamKeyTransactionModelManager(BaseManager["TeamKeyTransaction"]):
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

        if features.has("organizations:dynamic-sampling", project.organization):
            from sentry.dynamic_sampling import RuleType, get_enabled_user_biases

            # check if option is enabled
            enabled_biases = get_enabled_user_biases(
                project.get_option("sentry:dynamic_sampling_biases", None)
            )
            # invalidate project config only when the rule is enabled
            if RuleType.BOOST_KEY_TRANSACTIONS_RULE.value in enabled_biases:
                schedule_invalidate_project_config(project_id=project.id, trigger=trigger)

    def post_save(self, *, instance: TeamKeyTransaction, created: bool, **kwargs: object) -> None:
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


@region_silo_model
class TeamKeyTransaction(Model):
    __relocation_scope__ = RelocationScope.Excluded

    # max_length here is based on the maximum for transactions in relay
    transaction = models.CharField(max_length=200)
    project_team = FlexibleForeignKey("sentry.ProjectTeam", db_constraint=False)
    organization = FlexibleForeignKey("sentry.Organization")

    # Custom Model Manager required to override post_save/post_delete method
    objects: ClassVar[TeamKeyTransactionModelManager] = TeamKeyTransactionModelManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_performanceteamkeytransaction"
        unique_together = (("project_team", "transaction"),)
