from __future__ import annotations

import orjson
import requests
from django.conf import settings

from sentry.seer.signed_seer_api import sign_with_seer_secret


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

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
        timeout=5,
    )
    response.raise_for_status()
