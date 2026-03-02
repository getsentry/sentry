from __future__ import annotations

import orjson

from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)


def trigger_supergroups_embedding(
    organization_id: int,
    group_id: int,
    artifact_data: dict,
) -> None:
    path = "/v0/issues/supergroups"
    body = orjson.dumps(
        {
            "organization_id": organization_id,
            "group_id": group_id,
            "artifact_data": artifact_data,
        }
    )

    response = make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        path,
        body,
        timeout=5,
    )
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
