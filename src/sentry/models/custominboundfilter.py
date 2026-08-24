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
    """
    The data a filter matches against.

    ``ALL`` is the catch-all: the filter matches every data type Sentry ingests,
    including ones added after the filter was written. Only conditions that read a
    field every data type carries, such as ``release``, are available to it.
    """

    ALL = "all"
    ERROR = "error"
    LOG = "log"
    METRIC = "metric"


# The data type each condition reads a field of. A condition is absent when its field
# is carried by every data type, such as `release`, since such a condition does not
# tie a filter to one data type.
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
    data_type = models.CharField(
        max_length=32,
        choices=[(data_type, data_type) for data_type in CustomInboundFilterDataType],
        default=CustomInboundFilterDataType.ERROR,
        db_default=CustomInboundFilterDataType.ERROR.value,
    )
    conditions = models.JSONField(default=list)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_custominboundfilter"

    __repr__ = sane_repr("project_id", "name")
