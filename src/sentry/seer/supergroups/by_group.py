from __future__ import annotations

from collections.abc import Sequence

import orjson

from sentry.models.organization import Organization
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    SupergroupsByGroupIdsResponse,
    make_supergroups_get_by_group_ids_request,
)
from sentry.viewer_context import ViewerContext, viewer_context_scope


def get_supergroups_by_group_ids(
    organization: Organization,
    group_ids: Sequence[int],
    *,
    user_id: int | None = None,
) -> SupergroupsByGroupIdsResponse:
    vc = ViewerContext(organization_id=organization.id, user_id=user_id)
    with viewer_context_scope(vc):
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
