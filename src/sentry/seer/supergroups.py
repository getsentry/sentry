from __future__ import annotations

from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    SupergroupsEmbeddingRequest,
    make_supergroups_embedding_request,
)


def trigger_supergroups_embedding(
    organization_id: int,
    group_id: int,
    artifact_data: dict,
) -> None:
    body = SupergroupsEmbeddingRequest(
        organization_id=organization_id,
        group_id=group_id,
        artifact_data=artifact_data,
    )
    response = make_supergroups_embedding_request(body, timeout=5)
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
