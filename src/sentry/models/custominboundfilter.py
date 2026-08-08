from __future__ import annotations

from enum import StrEnum

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr


class CustomInboundFilterConditionType(StrEnum):
    ERROR_MESSAGE = "error_message"
    LOG_MESSAGE = "log_message"
    METRIC_NAME = "metric_name"
    RELEASE = "release"


# A filter targets a single data category, so a filter's conditions may contain
# at most one of these condition types. `RELEASE` combines with any of them.
PRIMARY_CONDITION_TYPES = frozenset(
    (
        CustomInboundFilterConditionType.ERROR_MESSAGE,
        CustomInboundFilterConditionType.LOG_MESSAGE,
        CustomInboundFilterConditionType.METRIC_NAME,
    )
)


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
