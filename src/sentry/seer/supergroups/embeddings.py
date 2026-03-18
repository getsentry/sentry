from __future__ import annotations

from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    SeerViewerContext,
    SupergroupsEmbeddingRequest,
    make_supergroups_embedding_request,
)


def trigger_supergroups_embedding(
    organization_id: int,
    group_id: int,
    project_id: int,
    artifact_data: dict,
) -> None:
    body = SupergroupsEmbeddingRequest(
        organization_id=organization_id,
        group_id=group_id,
        project_id=project_id,
        artifact_data=artifact_data,
    )
    viewer_context = SeerViewerContext(organization_id=organization_id)
    response = make_supergroups_embedding_request(body, timeout=5, viewer_context=viewer_context)
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
