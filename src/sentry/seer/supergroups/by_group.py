from __future__ import annotations

from collections.abc import Sequence

import orjson

from sentry.models.organization import Organization
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    SupergroupsByGroupIdsResponse,
    make_supergroups_get_by_group_ids_request,
)


def get_supergroups_by_group_ids(
    organization: Organization,
    group_ids: Sequence[int],
) -> SupergroupsByGroupIdsResponse:
    response = make_supergroups_get_by_group_ids_request(
        {
            "organization_id": organization.id,
            "group_ids": list(group_ids),
        },
        timeout=10,
    )
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
    return orjson.loads(response.data)
