from typing import Any, TypedDict

from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    ExplorerExportIndexesRequest,
    SeerViewerContext,
    make_explorer_export_indexes_request,
)


class ExplorerExportIndexesResponse(TypedDict):
    org_id: int
    version: int
    tables: dict[str, list[dict[str, Any]]]


def export_explorer_indexes(*, org_id: int) -> ExplorerExportIndexesResponse:
    """Export all explorer index rows for an org from Seer's database.

    Intended for local eval DB seeding — calls the Seer export endpoint and
    returns the serialized table data.
    """
    viewer_context = SeerViewerContext(organization_id=org_id)
    body = ExplorerExportIndexesRequest(org_id=org_id)
    response = make_explorer_export_indexes_request(body, viewer_context=viewer_context)
    if response.status >= 400:
        raise SeerApiError("Seer export-indexes request failed", response.status)
    return response.json()
