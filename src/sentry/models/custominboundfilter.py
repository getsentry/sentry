from __future__ import annotations

import hashlib
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


CUSTOM_INBOUND_FILTER_ID_PREFIX = "custom-inbound-filter:"

_ID_HASH_LENGTH = 12


def custom_inbound_filter_id(project_id: int, row_id: int) -> str:
    """
    Builds the identifier a filter reports under, in Relay's filter config and in outcomes.

    The row id is hashed together with the project so that the identifier does not
    disclose how many filters exist, and cannot be guessed for another project.
    """
    digest = hashlib.sha256(f"{project_id}:{row_id}".encode()).hexdigest()
    return f"{CUSTOM_INBOUND_FILTER_ID_PREFIX}{digest[:_ID_HASH_LENGTH]}"


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
