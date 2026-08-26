import uuid

WORKFLOW_EVALUATION_NAMESPACE = uuid.UUID("b1ad3094-f950-4dfc-9c5a-cf8a3bf43f62")


def get_workflow_evaluation_id(
    *,
    project_id: int,
    group_id: int,
    event_id: str,
    workflow_id: int,
) -> str:
    """Return the stable ID for one event's evaluation of one workflow."""
    return uuid.uuid5(
        WORKFLOW_EVALUATION_NAMESPACE,
        f"{project_id}:{group_id}:{event_id}:{workflow_id}",
    ).hex
