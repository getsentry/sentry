from __future__ import annotations

import builtins
import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.db import models
from django.db.models import UniqueConstraint
from django.db.models.signals import pre_save
from django.dispatch import receiver
from jsonschema import ValidationError

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType
from sentry.models.owner_base import OwnerModel

from .json_config import JSONConfigBase

if TYPE_CHECKING:
    from sentry.workflow_engine.handlers.detector import DetectorHandler

logger = logging.getLogger(__name__)


@region_silo_model
class Detector(DefaultFieldsModel, OwnerModel, JSONConfigBase):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE, null=True)
    name = models.CharField(max_length=200)

    # The data sources that the detector is watching
    data_sources = models.ManyToManyField(
        "workflow_engine.DataSource", through="workflow_engine.DataSourceDetector"
    )

    # If the detector is not enabled, it will not be evaluated. This is how we "snooze" a detector
    enabled = models.BooleanField(db_default=True)

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
        constraints = OwnerModel.Meta.constraints + [
            UniqueConstraint(
                fields=["project", "name"],
                name="workflow_engine_detector_proj_name",
            )
        ]

    error_detector_project_options = {
        "fingerprinting_rules": "sentry:fingerprinting_rules",
        "resolve_age": "sentry:resolve_age",
    }

    @property
    def group_type(self) -> builtins.type[GroupType]:
        group_type = grouptype.registry.get_by_slug(self.type)
        if not group_type:
            raise ValueError(f"Group type {self.type} not registered")
        return group_type

    @property
    def detector_handler(self) -> DetectorHandler | None:
        group_type = self.group_type
        if not group_type:
            logger.error(
                "No registered grouptype for detector",
                extra={
                    "detector_id": self.id,
                    "detector_type": self.type,
                },
            )
            return None

        if not group_type.detector_handler:
            logger.error(
                "Registered grouptype for detector has no detector_handler",
                extra={
                    "group_type": str(group_type),
                    "detector_id": self.id,
                    "detector_type": self.type,
                },
            )
            return None
        return group_type.detector_handler(self)

    def get_audit_log_data(self) -> dict[str, Any]:
        # TODO: Create proper audit log data for the detector, group and conditions
        return {}

    def get_option(
        self, key: str, default: Any | None = None, validate: Callable[[object], bool] | None = None
    ) -> Any:
        if not self.project:
            raise ValueError("Detector must have a project to get options")

        return self.project.get_option(key, default=default, validate=validate)


@receiver(pre_save, sender=Detector)
def enforce_config_schema(sender, instance: Detector, **kwargs):
    """
    Ensures the detector type is valid in the grouptype registry.
    This needs to be a signal because the grouptype registry's entries are not available at import time.
    """
    group_type = instance.group_type
    if not group_type:
        raise ValueError(f"No group type found with type {instance.type}")

    if not isinstance(instance.config, dict):
        raise ValidationError("Detector config must be a dictionary")

    config_schema = group_type.detector_config_schema
    if instance.config:
        instance.validate_config(config_schema)
