from __future__ import annotations

import builtins
import logging
from collections.abc import Callable, Iterable
from typing import TYPE_CHECKING, Any, ClassVar, Self, TypedDict

from django.conf import settings
from django.db import models
from django.db.models import Q
from jsonschema import ValidationError

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.db.models.utils import is_model_attr_cached
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType
from sentry.models.owner_base import OwnerModel
from sentry.utils.cache import cache
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.endpoints.utils.detector_filters import get_detector_type_filters
from sentry.workflow_engine.models import DataCondition
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import DetectorSettings, DetectorType
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

from .json_config import JSONConfigBase

if TYPE_CHECKING:
    from sentry.models.project import Project
    from sentry.workflow_engine.handlers.detector import BaseDetectorHandler
    from sentry.workflow_engine.models.data_condition_group import DataConditionGroupSnapshot

logger = logging.getLogger(__name__)


def get_detector_project_type_cache_key(project_id: int, detector_type: str) -> str:
    """Generate cache key for detector lookup by project and type."""
    return f"detector:by_proj_type:{project_id}:{detector_type}"


class DetectorSnapshot(TypedDict):
    id: int
    type: str
    enabled: bool
    status: int
    trigger_condition: DataConditionGroupSnapshot | None


class DetectorQuerySet(BaseQuerySet["Detector"]):
    # For write methods which skip signals, enforce detector config validation. (In addition to the
    # methods overridden here, this also covers `instance.update()`, since that calls
    # `QuerySet.update()`. And `save()` triggers the `enforce_config_schema_signal` pre-save signal,
    # so it does validation on its own.)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # Set by our overridden `bulk_update()` and then checked by the overridden `update`, to
        # prevent running validation twice
        self._config_validated = False

    def _clone(self) -> Self:
        # Ensure that our validation flag doesn't get lost in the process of cloning the queryset
        cloned_queryset = super()._clone()
        cloned_queryset._config_validated = self._config_validated
        return cloned_queryset

    def update(self, **kwargs: Any) -> int:
        # With the post-update signal enabled, `super().update()` goes through
        # `update_with_returning()`, which does the validation itself
        if not self._with_post_update_signal and not self._config_validated:
            self._validate_config(kwargs)
        return super().update(**kwargs)

    def update_with_returning(
        self, returned_fields: list[str], **kwargs: Any
    ) -> list[tuple[Any, ...]]:
        self._validate_config(kwargs)
        return super().update_with_returning(returned_fields, **kwargs)

    def bulk_create(self, objs: Iterable[Detector], *args: Any, **kwargs: Any) -> list[Detector]:
        # Force `objs` to be a list so it can be iterated multiple times (here in this method and in
        # `super`'s `bulk_create`).
        objs = list(objs)

        for detector in objs:
            detector.enforce_config_schema()

        return super().bulk_create(objs, *args, **kwargs)

    def bulk_update(
        self, objs: Iterable[Detector], fields: Iterable[str], *args: Any, **kwargs: Any
    ) -> int:
        # Force `objs` and `fields` to be lists so they can iterated them multiple times (here in
        # this method and in `super`'s `bulk_update`).
        objs = list(objs)
        fields = list(fields)

        # Django's `bulk_update()` writes the objects by passing `Case` objects to `update()`, which
        # our overridden `update()` won't be able to validate, so do the validation here and then
        # mark the queryset as already validated. (We clone first so that the flag doesn't persist
        # past this `bulk_update` call.)
        if "config" in fields or "type" in fields:
            for detector in objs:
                detector.enforce_config_schema()
        cloned_queryset = self._clone()
        cloned_queryset._config_validated = True

        return super(DetectorQuerySet, cloned_queryset).bulk_update(objs, fields, *args, **kwargs)

    def _validate_config(self, updated_values: dict[str, Any]) -> None:
        """
        Ensure that if the given updates are applied, every row in the queryset will end up with a
        valid config for its type.
        """
        if self._config_validated:
            return

        for field_name in ("config", "type"):
            if field_name in updated_values and hasattr(
                updated_values[field_name], "resolve_expression"
            ):
                raise ValueError(
                    f"Detector `{field_name}` can't be set to a database expression, since then it"
                    + " can't be validated against the detector type's config schema"
                )

        new_detector_type = updated_values.get("type")
        new_config = updated_values.get("config")

        # Neither updated
        if new_config is None and new_detector_type is None:
            return
        # Both updated
        elif new_config is not None and new_detector_type is not None:
            self.model(type=new_detector_type, config=new_config).enforce_config_schema()
        # Only config updated
        elif new_config is not None and new_detector_type is None:
            # We need a blank `order_by` here in order to clear any existing ordering on the
            # queryset, because Django includes columns used for ordering in the `distinct`
            # expression in the underlying SQL
            existing_types_in_queryset = (
                self._without_select_for_update_lock()
                .order_by()
                .values_list("type", flat=True)
                .distinct()
            )
            for existing_detector_type in existing_types_in_queryset:
                self.model(type=existing_detector_type, config=new_config).enforce_config_schema()
        # Only type updated
        elif new_config is None and new_detector_type is not None:
            existing_configs_in_queryset = self._without_select_for_update_lock().values_list(
                "config", flat=True
            )
            for existing_config in existing_configs_in_queryset:
                self.model(config=existing_config, type=new_detector_type).enforce_config_schema()

    def _without_select_for_update_lock(self) -> Self:
        """
        Return a copy of the queryset with `select_for_update()` disabled. Used for the reads done
        during `config` validation, since they would crash were the validation ever done as part of
        a `select_for_update().update(...)` call outside of a transaction. (One branch of the
        validation also uses a `distinct()` call, which is incompatible with the row lock even if a
        transaction is used.)
        """
        queryset = self._clone()
        queryset.query.select_for_update = False
        return queryset

    def with_type_filters(self) -> Self:
        """
        Returns a queryset with detector type-specific filters applied. This
        filters out detectors based on their type settings

        Use this instead of get_queryset() in API endpoints and user-facing
        code to ensure filtered detectors are hidden. This is the recommended
        way to query detectors.
        """
        return self.filter(get_detector_type_filters())

    def by_organization(self, organization_id: int) -> Self:
        """
        Returns a queryset of detectors scoped to the given organization.
        Project-scoped detectors are matched via project__organization.
        Null-project (all-projects) detectors are matched via config__organization_id.
        """
        from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

        return self.filter(
            Q(project__organization_id=organization_id)
            | Q(
                project__isnull=True,
                type=IssueStreamGroupType.slug,
                config__organization_id=organization_id,
            )
        )


class DetectorManager(BaseManager["Detector"]):
    def get_queryset(self) -> DetectorQuerySet:
        return DetectorQuerySet(self.model, using=self._db).exclude(
            status__in=(ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS)
        )

    def with_type_filters(self) -> DetectorQuerySet:
        return self.get_queryset().with_type_filters()

    def by_organization(self, organization_id: int) -> DetectorQuerySet:
        return self.get_queryset().by_organization(organization_id)


@cell_silo_model
class Detector(DefaultFieldsModel, OwnerModel, JSONConfigBase):
    __relocation_scope__ = RelocationScope.Organization

    objects: ClassVar[DetectorManager] = DetectorManager()
    objects_for_deletion: ClassVar[BaseManager[Detector]] = BaseManager()

    project = FlexibleForeignKey("sentry.Project", null=True, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)

    # The data sources that the detector is watching
    data_sources = models.ManyToManyField(
        "workflow_engine.DataSource", through="workflow_engine.DataSourceDetector"
    )

    # If the detector is not enabled, it will not be evaluated. This is how we "snooze" a detector
    enabled = models.BooleanField(db_default=True)

    # The detector's status - used for tracking disabled and deletion state.
    # A Detector that isn't allowed by plan or is effectively temporarily
    # deleted for some other reason should have status=ObjectStatus.DISABLED.
    # The 'enabled' field is for user-applied deactivation like snoozes.
    status = models.SmallIntegerField(db_default=ObjectStatus.ACTIVE)

    # Optionally set a description of the detector, this will be used in notifications
    description = models.TextField(null=True)

    # This will emit an event for the workflow to process
    workflow_condition_group = FlexibleForeignKey(
        "workflow_engine.DataConditionGroup",
        blank=True,
        null=True,
        unique=True,
        on_delete=models.SET_NULL,
    )

    # A DetectorType value selecting an implementation in detector_settings_registry.
    type = models.CharField(max_length=200)

    # The user that created the detector
    created_by_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")

    class Meta(OwnerModel.Meta):
        constraints = OwnerModel.Meta.constraints
        indexes = [
            models.Index(
                models.F("config__organization_id"),
                name="detector_all_projects_org_idx",
                condition=models.Q(project__isnull=True, type=IssueStreamGroupType.slug),
            )
        ]

    error_detector_project_options = {
        "fingerprinting_rules": "sentry:fingerprinting_rules",
        "resolve_age": "sentry:resolve_age",
    }

    CACHE_TTL = 60 * 10

    @property
    def linked_project(self) -> Project:
        if self.project is None:
            raise ValueError("Detector is not project-scoped")
        return self.project

    @classmethod
    def get_default_detector_for_project(cls, project_id: int, detector_type: str) -> Detector:
        cache_key = get_detector_project_type_cache_key(project_id, detector_type)
        detector = cache.get(cache_key)
        if detector is None:
            detector = cls.objects.get(project_id=project_id, type=detector_type)
            cache.set(cache_key, detector, cls.CACHE_TTL)
        return detector

    @classmethod
    def get_error_detector_for_project(cls, project_id: int) -> Detector:
        from sentry.grouping.grouptype import ErrorGroupType

        return cls.get_default_detector_for_project(project_id, ErrorGroupType.slug)

    @classmethod
    def get_issue_stream_detector_for_project(cls, project_id: int) -> Detector:
        from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

        return cls.get_default_detector_for_project(project_id, IssueStreamGroupType.slug)

    @property
    def group_type(self) -> builtins.type[GroupType]:
        group_type = grouptype.registry.get_by_slug(self.type)
        if not group_type:
            raise ValueError(f"Group type '{self.type}' not registered")

        return group_type

    @property
    def detector_handler(self) -> BaseDetectorHandler[Any, Any] | None:
        handler = self.settings.handler
        if handler is None:
            logger.error(
                "Registered detector type has no detector_handler",
                extra={
                    "detector_id": self.id,
                    "detector_type": self.type,
                },
            )
            return None
        return handler(self)

    @property
    def settings(self) -> builtins.type[DetectorSettings]:
        try:
            detector_type = DetectorType(self.type)
        except ValueError as exc:
            # Report unexpected types on existing detectors; new instances only raise.
            if not self._state.adding:
                logger.exception(
                    "Existing detector has a type outside DetectorType",
                    extra={"detector_id": self.id, "detector_type": self.type},
                )
            raise ValueError(f"Detector type '{self.type}' not registered") from exc

        try:
            return detector_settings_registry.get(detector_type)
        except NoRegistrationExistsError:
            if not self._state.adding:
                logger.exception(
                    "Existing detector's DetectorType has no registered settings",
                    extra={"detector_id": self.id, "detector_type": self.type},
                )
            raise

    def get_snapshot(self) -> DetectorSnapshot:
        trigger_condition = None
        if self.workflow_condition_group:
            trigger_condition = self.workflow_condition_group.get_snapshot()

        return {
            "id": self.id,
            "type": self.type,
            "enabled": self.enabled,
            "status": self.status,
            "trigger_condition": trigger_condition,
        }

    def get_audit_log_data(self) -> dict[str, Any]:
        return {"name": self.name}

    def get_option(
        self, key: str, default: Any | None = None, validate: Callable[[object], bool] | None = None
    ) -> Any:
        if not self.project:
            raise ValueError("Detector must have a project to get options")

        return self.project.get_option(key, default=default, validate=validate)

    def get_conditions(self) -> BaseQuerySet[DataCondition]:
        has_cached_condition_group = is_model_attr_cached(self, "workflow_condition_group")
        conditions = None

        if has_cached_condition_group:
            if self.workflow_condition_group is not None:
                has_cached_conditions = is_model_attr_cached(
                    self.workflow_condition_group, "conditions"
                )
                if has_cached_conditions:
                    conditions = self.workflow_condition_group.conditions.all()

        if conditions is None:
            # if we don't have the information cached execute a single query to return them
            # (accessing as self.workflow_condition_group.conditions.all() issues 2 queries)
            conditions = DataCondition.objects.filter(condition_group__detector=self)

        return conditions

    def enforce_config_schema(self) -> None:
        """
        Validates enum membership, registered settings, and configuration.
        This needs to be available independently so callers can validate configs
        without saving.
        """
        config_schema = self.settings.config_schema
        if config_schema is None:
            return

        if not isinstance(self.config, dict):
            raise ValidationError("Detector config must be a dictionary")

        self.validate_config(config_schema)
