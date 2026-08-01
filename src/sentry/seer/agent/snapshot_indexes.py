import logging

from pydantic import ValidationError

from sentry.seer.models import SeerApiError
from sentry.seer.sentry_data_models import AgentExportIndexesResponse
from sentry.seer.signed_seer_api import (
    AgentExportIndexesRequest,
    make_agent_export_indexes_request,
)
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)


def export_agent_indexes(*, org_id: int) -> AgentExportIndexesResponse:
    """Export all explorer index rows for an org from Seer's database.

    Intended for local eval DB seeding — calls the Seer export endpoint and
    returns the serialized table data.
    """
    body = AgentExportIndexesRequest(org_id=org_id)
    response = make_agent_export_indexes_request(body)
    if response.status >= 400:
        raise SeerApiError("Seer export-indexes request failed", response.status)

    try:
        return AgentExportIndexesResponse(**response.json())
    except JSONDecodeError:
        logger.exception("Failed to parse Seer export-indexes response")
        raise SeerApiError("Seer returned invalid JSON response", response.status)
    except ValidationError:
        logger.exception("Seer export-indexes response failed schema validation")
        raise SeerApiError(
            "Seer returned a response that did not match the export-indexes schema",
            response.status,
        )
