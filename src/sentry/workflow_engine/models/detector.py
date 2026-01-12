from __future__ import annotations

import builtins
import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, ClassVar, TypedDict

from django.conf import settings
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from jsonschema import ValidationError

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.db.models.utils import is_model_attr_cached
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType
from sentry.models.owner_base import OwnerModel
from sentry.utils.cache import cache
from sentry.workflow_engine.models import DataCondition
from sentry.workflow_engine.types import DetectorSettings

from .json_config import JSONConfigBase

if TYPE_CHECKING:
    from sentry.workflow_engine.handlers.detector import DetectorHandler
    from sentry.workflow_engine.models.data_condition_group import DataConditionGroupSnapshot

logger = logging.getLogger(__name__)


class DetectorSnapshot(TypedDict):
    id: int
    type: str
    enabled: bool
    status: int
    trigger_condition: DataConditionGroupSnapshot | None


class DetectorManager(BaseManager["Detector"]):
    def get_queryset(self) -> BaseQuerySet[Detector]:
        return (
            super()
            .get_queryset()
            .exclude(status__in=(ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS))
        )

    def with_type_filters(self) -> BaseQuerySet[Detector]:
        """
        Returns a queryset with detector type-specific filters applied. This
        filters out detectors based on their type settings

        Use this instead of get_queryset() in API endpoints and user-facing
        code to ensure filtered detectors are hidden. This is the recommended
        way to query detectors.
        """
        return self.get_queryset().filter(grouptype.registry.get_detector_type_filters())


@region_silo_model
class Detector(DefaultFieldsModel, OwnerModel, JSONConfigBase):
    __relocation_scope__ = RelocationScope.Organization

    objects: ClassVar[DetectorManager] = DetectorManager()
    objects_for_deletion: ClassVar[BaseManager] = BaseManager()

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    name = models.CharField(max_length=200)

    # The data sources that the detector is watching
    data_sources = models.ManyToManyField(
        "workflow_engine.DataSource", through="workflow_engine.DataSourceDetector"
    )

    # If the detector is not enabled, it will not be evaluated. This is how we "snooze" a detector
    enabled = models.BooleanField(db_default=True)

    # The detector's status - used for tracking deletion state
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

    # maps to registry (sentry.issues.grouptype.registry) entries for GroupType.slug in sentry.issues.grouptype.GroupType
    type = models.CharField(max_length=200)

    # The user that created the detector
    created_by_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")

    class Meta(OwnerModel.Meta):
        constraints = OwnerModel.Meta.constraints

    error_detector_project_options = {
        "fingerprinting_rules": "sentry:fingerprinting_rules",
        "resolve_age": "sentry:resolve_age",
    }

    CACHE_TTL = 60 * 10

    @classmethod
    def _get_detector_project_type_cache_key(cls, project_id: int, detector_type: str) -> str:
        """Generate cache key for detector lookup by project and type."""
        return f"detector:by_proj_type:{project_id}:{detector_type}"

    @classmethod
    def _get_detector_ids_by_data_source_cache_key(cls, source_id: str, source_type: str) -> str:
        """Generate cache key for detector IDs lookup by data source."""
        return f"detector:ids_by_data_source:{source_type}:{source_id}"

    @classmethod
    def get_default_detector_for_project(cls, project_id: int, detector_type: str) -> Detector:
        cache_key = cls._get_detector_project_type_cache_key(project_id, detector_type)
        detector = cache.get(cache_key)
        if detector is None:
            detector = cls.objects.get(project_id=project_id, type=detector_type)
            cache.set(cache_key, detector, cls.CACHE_TTL)
        return detector

    @classmethod
    def get_detector_ids_by_data_source(cls, source_id: str, source_type: str) -> list[int]:
        """
        Get detector IDs associated with a data source.

        Returns just the IDs to avoid expensive joins through mapping tables,
        allowing callers to fetch full detector objects with their own filters
        and eager loading as needed.
        """
        cache_key = cls._get_detector_ids_by_data_source_cache_key(source_id, source_type)
        detector_ids = cache.get(cache_key)
        if detector_ids is None:
            detector_ids = list(
                cls.objects.filter(
                    data_sources__source_id=source_id,
                    data_sources__type=source_type,
                )
                .distinct()
                .values_list("id", flat=True)
            )
            cache.set(cache_key, detector_ids, 60)
        return detector_ids

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
    def detector_handler(self) -> DetectorHandler | None:
        group_type = self.group_type

        if self.settings.handler is None:
            logger.error(
                "Registered grouptype for detector has no detector_handler",
                extra={
                    "group_type": str(group_type),
                    "detector_id": self.id,
                    "detector_type": self.type,
                },
            )
            return None
        return self.settings.handler(self)

    @property
    def settings(self) -> DetectorSettings:
        settings = self.group_type.detector_settings

        if settings is None:
            raise ValueError("Registered grouptype has no detector settings")

        return settings

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


def enforce_config_schema(instance: Detector) -> None:
    """
    Ensures the detector type is valid in the grouptype registry.
    This needs to be available independently so callers can validate configs
    without saving.
    """
    group_type = instance.group_type
    if not group_type:
        raise ValueError(f"No group type found with type {instance.type}")

    if not group_type.detector_settings:
        return

    if not isinstance(instance.config, dict):
        raise ValidationError("Detector config must be a dictionary")

    instance.validate_config(group_type.detector_settings.config_schema)


@receiver(pre_save, sender=Detector)
def enforce_config_schema_signal(sender, instance: Detector, **kwargs):
    """
    This needs to be a signal because the grouptype registry's entries are not available at import time.
    """
    enforce_config_schema(instance)
