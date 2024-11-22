from __future__ import annotations

import builtins
import logging
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupType
from sentry.models.owner_base import OwnerModel

from .json_config import JSONConfigBase

if TYPE_CHECKING:
    from sentry.workflow_engine.processors.detector import DetectorHandler

logger = logging.getLogger(__name__)


@region_silo_model
class Detector(DefaultFieldsModel, OwnerModel, JSONConfigBase):
    __relocation_scope__ = RelocationScope.Organization

    # TODO - Finish removing this field
    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE, null=True)

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

    # The type of detector that is being used, this is used to determine the class
    # to load for the detector
    type = models.CharField(max_length=200)

    # The user that created the detector
    created_by_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")

    @property
    def CONFIG_SCHEMA(self) -> dict[str, Any]:
        raise NotImplementedError('Subclasses must define a "CONFIG_SCHEMA" attribute')

    class Meta(OwnerModel.Meta):
        constraints = OwnerModel.Meta.constraints + [
            UniqueConstraint(
                fields=["organization", "name"],
                name="workflow_engine_detector_org_name",
            )
        ]

    @property
    def group_type(self) -> builtins.type[GroupType] | None:
        return grouptype.registry.get_by_slug(self.type)

    @property
    def detector_handler(self) -> DetectorHandler | None:
        group_type = self.group_type
        if not group_type:
            logger.error(
                "No registered grouptype for detector",
                extra={
                    "group_type": str(group_type),
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
