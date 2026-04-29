from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.tasks.common import (
    ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    OrganizationDataVolume,
)
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.constants import SAMPLING_MODE_HIGHEST_ACCURACY
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

EAP_ORGANIZATION_VOLUME_QUERY_STRINGS = {
    SamplingMeasure.SEGMENTS: "is_transaction:true",
    SamplingMeasure.SPANS: "",
}


def _get_aggregate_int(row: Mapping[str, Any], column: str) -> int:
    value = row.get(column)
    return int(value) if value is not None else 0


def get_eap_organization_volume(
    organization: Organization,
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    *,
    measure: SamplingMeasure = SamplingMeasure.SEGMENTS,
) -> OrganizationDataVolume | None:
    projects = list(
        Project.objects.filter(organization_id=organization.id, status=ObjectStatus.ACTIVE)
    )
    if not projects:
        return None

    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    result = Spans.run_table_query(
        params=SnubaParams(
            start=start_time,
            end=end_time,
            projects=projects,
            organization=organization,
        ),
        query_string=EAP_ORGANIZATION_VOLUME_QUERY_STRINGS[measure],
        selected_columns=["count()", "count_sample()"],
        orderby=None,
        offset=0,
        limit=1,
        referrer=Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_ORG_VOLUME.value,
        config=SearchResolverConfig(
            auto_fields=True,
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
        ),
        sampling_mode=SAMPLING_MODE_HIGHEST_ACCURACY,
    )

    data = result.get("data")
    if not data:
        return None

    row = data[0]
    total = _get_aggregate_int(row, "count()")
    if total <= 0:
        return None
    indexed = _get_aggregate_int(row, "count_sample()")

    return OrganizationDataVolume(org_id=organization.id, total=total, indexed=indexed)
