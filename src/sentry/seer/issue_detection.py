import logging

from sentry.models.project import Project
from sentry.tasks.llm_issue_detection.detection import (
    DetectedIssue,
    create_issue_occurrence_from_detection,
)

logger = logging.getLogger(__name__)


def create_issue_occurrence(
    *,
    organization_id: int,
    project_id: int,
    detected_issue: dict,
) -> dict:
    """
    Create an issue occurrence from Seer detection data.

    Called by Seer after async LLM analysis completes, see analyze_issue_endpoint.
    Currently used for LLM-detected performance issues, could be expanded to support other detection types.

    Args:
        organization_id: The organization ID
        project_id: The project ID where the issue should be created
        detected_issue: Dict containing DetectedIssue fields (title, explanation,
            impact, evidence, offender_span_ids, trace_id, transaction_name, etc.)

    Returns:
        Dict with "success": True on successful issue creation
    """
    issue = DetectedIssue.parse_obj(detected_issue)
    effective_project_id = issue.project_id if issue.project_id is not None else project_id
    project = Project.objects.get(id=effective_project_id, organization_id=organization_id)
    create_issue_occurrence_from_detection(detected_issue=issue, project=project)

    logger.info(
        "seer_rpc.create_issue_occurrence.success",
        extra={
            "organization_id": organization_id,
            "title": issue.title,
            "trace_id": issue.trace_id,
            "project_id": effective_project_id,
            "category": issue.category,
            "subcategory": issue.subcategory,
        },
    )

    return {"success": True}
