from __future__ import annotations

from typing import ClassVar, Literal

from django.contrib.postgres.fields.array import ArrayField
from django.db import models, router, transaction
from django.db.models import CheckConstraint, Q, UniqueConstraint
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedBigIntegerField, BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.models.dashboard_widget import TypesClass
from sentry.models.organization import Organization
from sentry.search.eap.types import SupportedTraceItemType
from sentry.search.events.constants import DURATION_UNITS, SIZE_UNITS
from sentry.users.models.user import User


class ExploreSavedQueryDataset(TypesClass):
    SPANS = 0
    OURLOGS = 1
    METRICS = 2
    REPLAYS = 3
    AI_CONVERSATIONS = 4
    # This is a temporary dataset to be used for the discover -> explore migration.
    # It will track which queries are generated from discover queries.
    SEGMENT_SPANS = 101

    TYPES = [
        (SPANS, "spans"),
        (OURLOGS, "logs"),
        (SEGMENT_SPANS, "segment_spans"),
        (METRICS, "metrics"),
        (REPLAYS, "replays"),
        (AI_CONVERSATIONS, "ai_conversations"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


@cell_silo_model
class ExploreSavedQueryProject(Model):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project")
    explore_saved_query = FlexibleForeignKey("explore.ExploreSavedQuery")

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedqueryproject"
        unique_together = (("project", "explore_saved_query"),)


@cell_silo_model
class ExploreSavedQueryLastVisited(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    explore_saved_query = FlexibleForeignKey("explore.ExploreSavedQuery")

    last_visited = models.DateTimeField(null=False, default=timezone.now)

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedquerylastvisited"
        constraints = [
            UniqueConstraint(
                fields=["user_id", "organization_id", "explore_saved_query_id"],
                name="explore_exploresavedquerylastvisited_unique_last_visited_per_org_user_query",
            )
        ]


@cell_silo_model
class ExploreSavedQuery(DefaultFieldsModel):
    """
    A saved Explore query
    """

    __relocation_scope__ = RelocationScope.Organization

    projects = models.ManyToManyField("sentry.Project", through=ExploreSavedQueryProject)
    organization = FlexibleForeignKey("sentry.Organization")
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    name = models.CharField(max_length=255)
    query = models.JSONField()
    visits = BoundedBigIntegerField(null=True, default=1)
    last_visited = models.DateTimeField(null=True, default=timezone.now)
    dataset = BoundedPositiveIntegerField(
        choices=ExploreSavedQueryDataset.as_choices(), default=ExploreSavedQueryDataset.SPANS
    )
    is_multi_query = models.BooleanField(default=False)
    # The corresponding prebuilt_id found in hardcoded prebuilt queries from src/sentry/explore/endpoints/explore_saved_queries.py
    # If the saved query is not a prebuilt query, this will be None
    prebuilt_id = BoundedPositiveIntegerField(null=True, db_default=None)
    # The version of the prebuilt query. If the version found in the explore_saved_queries.py hardcoded list is greater, then the saved
    # query out of date and should be updated..
    prebuilt_version = BoundedPositiveIntegerField(null=True, db_default=None)
    # This field is to be used for the discover -> explore migration. This contains the reason why any part
    # of the saved query was changed so we can display our reasonings in the UI
    changed_reason = models.JSONField(null=True, default=None)

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedquery"
        unique_together = (("organization", "prebuilt_id"),)

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


class ExploreSavedQueryStarredManager(BaseManager["ExploreSavedQueryStarred"]):
    def get_starred_query(
        self, organization: Organization, user_id: int, query: ExploreSavedQuery
    ) -> ExploreSavedQueryStarred | None:
        """
        Returns the starred query if it exists, otherwise None.
        """
        return self.filter(
            organization=organization, user_id=user_id, explore_saved_query=query
        ).first()

    def insert_starred_query(
        self,
        organization: Organization,
        user: User,
        query: ExploreSavedQuery,
        starred: bool = True,
    ) -> bool:
        """
        Inserts a new starred query at the end of the list.

        Args:
            organization: The organization the queries belong to
            user: The user whose starred queries are being updated
            explore_saved_query: The query to insert

        Returns:
            True if the query was starred, False if the query was already starred
        """
        from sentry.explore.utils import next_starred_position

        with transaction.atomic(using=router.db_for_write(ExploreSavedQueryStarred)):
            if self.get_starred_query(organization, user.id, query):
                return False

            position: int
            position = next_starred_position(organization, user.id)
            self.create(
                organization=organization,
                user_id=user.id,
                explore_saved_query=query,
                position=position,
                starred=starred,
            )
            return True

    def insert_starred_query_alphabetically(
        self,
        organization: Organization,
        user: User,
        query: ExploreSavedQuery,
    ) -> bool:
        """
        Inserts a starred query at the position of the next prebuilt starred query
        whose name sorts after this one, shifting later positions by 1. Falls back
        to appending at the end when nothing sorts later.
        """
        from sentry.explore.utils import next_starred_position, shift_starred_positions

        with transaction.atomic(using=router.db_for_write(ExploreSavedQueryStarred)):
            if self.get_starred_query(organization, user.id, query):
                return False

            next_prebuilt = (
                self.filter(
                    organization=organization,
                    user_id=user.id,
                    starred=True,
                    position__isnull=False,
                    explore_saved_query__prebuilt_id__isnull=False,
                    explore_saved_query__name__gt=query.name,
                )
                .order_by("position")
                .first()
            )

            position: int
            if next_prebuilt is None or next_prebuilt.position is None:
                position = next_starred_position(organization, user.id)
            else:
                position = next_prebuilt.position
                shift_starred_positions(
                    organization, user.id, from_position=position, delta=1, inclusive=True
                )

            self.create(
                organization=organization,
                user_id=user.id,
                explore_saved_query=query,
                position=position,
                starred=True,
            )
            return True

    def delete_starred_query(
        self, organization: Organization, user: User, query: ExploreSavedQuery
    ) -> bool:
        """
        Deletes a starred query from the list.
        Decrements the position of all queries after the deletion point.

        Args:
            organization: The organization the queries belong to
            user: The user whose starred queries are being updated
            explore_saved_query: The query to delete

        Returns:
            True if the query was unstarred, False if the query was already unstarred
        """
        from sentry.explore.utils import shift_starred_positions

        with transaction.atomic(using=router.db_for_write(ExploreSavedQueryStarred)):
            if not (starred_query := self.get_starred_query(organization, user.id, query)):
                return False

            deleted_position = starred_query.position
            starred_query.delete()

            if deleted_position is not None:
                shift_starred_positions(
                    organization, user.id, from_position=deleted_position, delta=-1
                )
            return True

    def updated_starred_query(
        self,
        organization: Organization,
        user: User,
        query: ExploreSavedQuery,
        starred: bool,
    ) -> bool:
        """
        Updates the starred status of a query.
        """
        from sentry.explore.utils import next_starred_position

        with transaction.atomic(using=router.db_for_write(ExploreSavedQueryStarred)):
            if not (starred_query := self.get_starred_query(organization, user.id, query)):
                return False

            starred_query.starred = starred
            if starred:
                starred_query.position = next_starred_position(organization, user.id)
            else:
                starred_query.position = None

            starred_query.save()
            return True


@cell_silo_model
class ExploreSavedQueryStarred(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    explore_saved_query = FlexibleForeignKey("explore.ExploreSavedQuery")

    position = models.PositiveSmallIntegerField(null=True, db_default=None)
    starred = models.BooleanField(db_default=True)

    objects: ClassVar[ExploreSavedQueryStarredManager] = ExploreSavedQueryStarredManager()

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedquerystarred"
        # Two queries cannot occupy the same position in an organization user's list of queries
        constraints = [
            UniqueConstraint(
                fields=["user_id", "organization_id", "position"],
                name="explore_exploresavedquerystarred_unique_query_position_per_org_user",
                deferrable=models.Deferrable.DEFERRED,
            )
        ]


class TraceItemTypes(TypesClass):
    """
    Integer-backed mirror of ``SupportedTraceItemType`` used for compact storage.

    Each member's name is the corresponding ``SupportedTraceItemType`` value, so the
    two can be converted with ``get_type_name`` / ``get_id_for_type_name``. The
    integer ids are stable identifiers and must never be reused or reordered. A test
    in ``tests/sentry/explore/test_models.py`` guards against drift from the enum.
    """

    SPANS = 0
    LOGS = 1
    TRACEMETRICS = 2
    UPTIME_RESULTS = 3
    PROFILE_FUNCTIONS = 4
    PREPROD = 5
    ATTACHMENTS = 6
    PROCESSING_ERRORS = 7
    OCCURRENCES = 8
    REPLAYS = 9

    TYPES = [
        (SPANS, SupportedTraceItemType.SPANS.value),
        (LOGS, SupportedTraceItemType.LOGS.value),
        (TRACEMETRICS, SupportedTraceItemType.TRACEMETRICS.value),
        (UPTIME_RESULTS, SupportedTraceItemType.UPTIME_RESULTS.value),
        (PROFILE_FUNCTIONS, SupportedTraceItemType.PROFILE_FUNCTIONS.value),
        (PREPROD, SupportedTraceItemType.PREPROD.value),
        (ATTACHMENTS, SupportedTraceItemType.ATTACHMENTS.value),
        (PROCESSING_ERRORS, SupportedTraceItemType.PROCESSING_ERRORS.value),
        (OCCURRENCES, SupportedTraceItemType.OCCURRENCES.value),
        (REPLAYS, SupportedTraceItemType.REPLAYS.value),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class TraceItemAttributeTypes(TypesClass):
    """The value type of an attribute, as exposed by the trace item attributes API."""

    STRING = 0
    NUMBER = 1
    BOOLEAN = 2

    TYPES = [
        (STRING, "string"),
        (NUMBER, "number"),
        (BOOLEAN, "boolean"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class TraceMetricTypes(TypesClass):
    """
    Integer-backed mirror of ``sentry.search.eap.trace_metrics.types.TraceMetricType``,
    the metric type of a trace metric value (counter / gauge / distribution).

    The integer ids are stable identifiers and must never be reused or reordered. A
    test in ``tests/sentry/explore/test_models.py`` guards against drift from
    ``ALLOWED_METRIC_TYPES``.
    """

    COUNTER = 0
    GAUGE = 1
    DISTRIBUTION = 2

    TYPES = [
        (COUNTER, "counter"),
        (GAUGE, "gauge"),
        (DISTRIBUTION, "distribution"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


@cell_silo_model
class TraceItemAttributeContext(DefaultFieldsModel):
    """
    Human (and agent) authored context for a trace item attribute (e.g. a span or
    log attribute). Used to surface descriptions and example values when building
    queries. Attributes are scoped to an organization and, optionally, a project
    (a null project means the context applies org-wide).
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")
    # A null project means the context applies to the whole organization.
    project = FlexibleForeignKey("sentry.Project", null=True)

    # The attribute this context is for, e.g. "http.method".
    attribute_key = models.CharField()
    item_type = BoundedPositiveIntegerField(choices=TraceItemTypes.as_choices())
    attribute_type = BoundedPositiveIntegerField(choices=TraceItemAttributeTypes.as_choices())

    # A short, one-line description of the attribute.
    brief = models.CharField(max_length=280, null=True)
    # Longer markdown notes / additional context about the attribute often used for agents.
    additional_context = models.TextField(null=True)
    # Example values the attribute can take, used to help build filters.
    examples = ArrayField(models.TextField(), default=list)

    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    updated_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    class Meta:
        app_label = "explore"
        db_table = "explore_traceitemattributecontext"
        # project is nullable, so unique_together would treat each null project as
        # distinct and allow duplicate org-wide rows. Use partial unique constraints
        # to enforce uniqueness for both the project-scoped and org-wide cases.
        constraints = [
            UniqueConstraint(
                fields=["organization", "project", "item_type", "attribute_key", "attribute_type"],
                name="explore_traceitemattr_unique_project_scoped",
                condition=Q(project__isnull=False),
            ),
            UniqueConstraint(
                fields=["organization", "item_type", "attribute_key", "attribute_type"],
                name="explore_traceitemattr_unique_org_scoped",
                condition=Q(project__isnull=True),
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "item_type", "attribute_key"]),
        ]

    __repr__ = sane_repr("organization_id", "project_id", "item_type", "attribute_key")


@cell_silo_model
class TraceItemAttributeValueContext(DefaultFieldsModel):
    """
    Human (and agent) authored context for a trace item attribute *value* (e.g. a
    specific custom metric). Used to surface descriptions of individual values when
    building queries.

    Under the hood metric names are attribute values, so for v0 ``attribute_name`` is
    typically ``metric.name`` and ``attribute_value`` is the metric's name. Context is
    always scoped to the whole organization; per-project context is not supported.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")

    # The attribute and value this context is for, e.g. "metric.name" / "my.counter".
    attribute_name = models.CharField()
    attribute_value = models.CharField()
    # For metrics this is the metric type (counter / gauge / distribution).
    attribute_type = BoundedPositiveIntegerField(choices=TraceMetricTypes.as_choices())
    item_type = BoundedPositiveIntegerField(choices=TraceItemTypes.as_choices())

    # A short, one-line description of the attribute value.
    brief = models.CharField(max_length=280, null=True)
    # Longer markdown notes / additional context about the attribute value.
    additional_context = models.TextField(null=True)

    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    updated_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    class Meta:
        app_label = "explore"
        db_table = "explore_traceitemattributevaluecontext"
        constraints = [
            UniqueConstraint(
                fields=[
                    "organization",
                    "item_type",
                    "attribute_name",
                    "attribute_value",
                    "attribute_type",
                ],
                name="explore_traceitemvalue_unique_org_scoped",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "item_type", "attribute_name", "attribute_value"]),
        ]

    __repr__ = sane_repr("organization_id", "item_type", "attribute_name")


@cell_silo_model
class ExploreSavedFormula(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")

    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    updated_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    # Matching 280 from attribute.brief
    description = models.CharField(max_length=280, null=True)
    # Making this 200 to match the max length of a tag
    name = models.CharField(max_length=200)
    unit = models.CharField(max_length=200, null=True)
    # max operators is 10 (so 3 characters each assuming a space)
    # which means 11 terms, assuming we eventually allow attributes, 200 characters each
    # for a total of 2230, rounding to 2500 for now
    formula = models.CharField(max_length=2500)
    # Formulas need to have a dataset since functions differ dataset to dataset
    dataset = BoundedPositiveIntegerField(
        choices=ExploreSavedQueryDataset.as_choices(), db_default=ExploreSavedQueryDataset.SPANS
    )

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedformula"
        constraints = [
            UniqueConstraint(
                fields=["organization_id", "name"],
                name="explore_exploresavedformula_unique_name_per_organization",
            ),
        ]

    @property
    def formula_type(self) -> Literal["duration", "size", "number"]:
        if self.unit in DURATION_UNITS:
            return "duration"
        elif self.unit in SIZE_UNITS:
            return "size"
        else:
            return "number"


class ParamItemTypes(TypesClass):
    COLUMN = 0
    NUMBER = 1
    CALCULATION = 2

    TYPES = [
        (COLUMN, "column"),
        (NUMBER, "number"),
        (CALCULATION, "calculation"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class KindItemTypes(TypesClass):
    PARAM = 0
    REFERENCE = 1

    TYPES = [
        (PARAM, "param"),
        (REFERENCE, "reference"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


@cell_silo_model
class ExploreSavedVariable(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")

    # Matching 280 from attribute.brief
    description = models.CharField(max_length=280, null=True)
    # Making this 200 to match the max length of a tag
    name = models.CharField(max_length=200)
    # Where does this param go in the list of function arguments
    order = BoundedPositiveIntegerField(null=True)
    kind = BoundedPositiveIntegerField(choices=KindItemTypes.as_choices())
    param_type = BoundedPositiveIntegerField(choices=ParamItemTypes.as_choices(), null=True)
    # TODO(wmak): Should this be longer?
    value = models.CharField(max_length=200)
    explore_saved_formula = FlexibleForeignKey(
        "explore.ExploreSavedFormula",
        related_name="variables",
    )

    class Meta:
        app_label = "explore"
        db_table = "explore_exploresavedvariable"
        constraints = [
            UniqueConstraint(
                fields=["explore_saved_formula_id", "order"],
                name="explore_exploresavedvariable_unique_order_per_formula",
                condition=Q(kind=KindItemTypes.PARAM),
            ),
            UniqueConstraint(
                fields=["explore_saved_formula_id", "name"],
                name="explore_exploresavedvariable_unique_name_per_formula",
            ),
            CheckConstraint(
                condition=Q(kind=KindItemTypes.PARAM, order__isnull=False)
                | ~Q(kind=KindItemTypes.PARAM),
                name="explore_exploresavedvariable_order_required_for_param",
            ),
            CheckConstraint(
                condition=Q(kind=KindItemTypes.PARAM, param_type__isnull=False)
                | ~Q(kind=KindItemTypes.PARAM),
                name="explore_exploresavedvariable_param_type_required_for_param",
            ),
        ]
