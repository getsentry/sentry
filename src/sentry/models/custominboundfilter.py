from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr


class CustomInboundFilterConditionType(StrEnum):
    ERROR_TYPE = "error_type"
    ERROR_MESSAGE = "error_message"
    LOG_MESSAGE = "log_message"
    METRIC_NAME = "metric_name"
    RELEASE = "release"


class CustomInboundFilterDataType(StrEnum):
    ERROR = "error"
    LOG = "log"
    METRIC = "metric"


# The data type each condition reads a field of. A filter targets a single data type,
# so its conditions must all map to the same one. `release` is absent because every
# data type carries a release, so it does not tie a filter to one data type.
DATA_TYPE_BY_CONDITION_TYPE: Mapping[
    CustomInboundFilterConditionType, CustomInboundFilterDataType
] = {
    CustomInboundFilterConditionType.ERROR_TYPE: CustomInboundFilterDataType.ERROR,
    CustomInboundFilterConditionType.ERROR_MESSAGE: CustomInboundFilterDataType.ERROR,
    CustomInboundFilterConditionType.LOG_MESSAGE: CustomInboundFilterDataType.LOG,
    CustomInboundFilterConditionType.METRIC_NAME: CustomInboundFilterDataType.METRIC,
}


@cell_silo_model
class CustomInboundFilter(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey(
        "sentry.Project", on_delete=models.CASCADE, related_name="custom_inbound_filters"
    )
    name = models.CharField(max_length=256, null=True, blank=True)
    active = models.BooleanField(default=True, db_default=True)
    conditions = models.JSONField(default=list)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_custominboundfilter"

    __repr__ = sane_repr("project_id", "name")
