from __future__ import annotations

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
    ALL = "all"
    ERROR = "error"
    LOG = "log"
    METRIC = "metric"
    SPAN = "span"


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
