from __future__ import annotations

from collections.abc import Sequence

from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.notebooks.endpoints.serializers.notebook import (
    NotebookOrchestrationSerializerResponse,
)
from sentry.notebooks.models import Notebook


def orchestration_summaries_by_investigation(
    investigations: Sequence[Notebook],
) -> dict[int, NotebookOrchestrationSerializerResponse]:
    return {
        investigation_id: {
            "phase": phase,
            "status": status,
            "heartbeatAt": heartbeat_at,
            "notebookRevision": notebook_revision,
        }
        for investigation_id, phase, status, heartbeat_at, notebook_revision in (
            InvestigationOrchestrationRun.objects.filter(
                investigation_id__in=[investigation.id for investigation in investigations]
            ).values_list(
                "investigation_id",
                "phase",
                "status",
                "heartbeat_at",
                "notebook_revision",
            )
        )
    }
