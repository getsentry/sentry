from __future__ import annotations

from collections.abc import Sequence

import orjson

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    RCASource,
    SeerViewerContext,
    SupergroupsByGroupIdsResponse,
    make_supergroups_get_by_group_ids_request,
)


def get_supergroups_by_group_ids(
    organization: Organization,
    group_ids: Sequence[int],
    *,
    user_id: int | None = None,
) -> SupergroupsByGroupIdsResponse:
    rca_source = (
        RCASource.LIGHTWEIGHT
        if features.has("organizations:supergroups-lightweight-rca-clustering-read", organization)
        else RCASource.EXPLORER
    )
    response = make_supergroups_get_by_group_ids_request(
        {
            "organization_id": organization.id,
            "group_ids": list(group_ids),
            "rca_source": rca_source,
        },
        SeerViewerContext(organization_id=organization.id, user_id=user_id),
        timeout=10,
    )
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
    return orjson.loads(response.data)
