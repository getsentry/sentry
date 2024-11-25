from typing import Any

from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models import DataPacket, Detector, DetectorWorkflow
from sentry.workflow_engine.types import DetectorType


def get_detector_by_event(evt: GroupEvent) -> Detector:
    issue_occurrence = evt.occurrence
    if issue_occurrence is None:
        # TODO - Don't hardcode the type as a string, make an enum
        detector = Detector.objects.get(project_id=evt.project_id, type=DetectorType.ERROR)
    else:
        detector = Detector.objects.get(id=issue_occurrence.evidence_data.get("detector_id", None))

    return detector


def process_workflows(
    data_packet: DataPacket,
    evt: GroupEvent,
):
    """
    The process_workflows method will:
    - take a data packet and the results
    - evaluate the workflows
    - then trigger any actions that are necessary.

    This method should be invoked inside of the issue platform, to ensure that the workflows are triggered
    with the correct IssueOccurrence information
    """
    # Check to see if the GroupEvent has an issue occurrence
    detector = get_detector_by_event(evt)

    # gather all the workflows based on the detector_id
    detector_workflows = DetectorWorkflow.objects.filter(detector_id=detector.id).prefetch_related(
        "workflow"
    )

    triggered_workflows: list[Any] = []
    workflows = [detector_workflow.workflow for detector_workflow in detector_workflows]

    for workflow in workflows:
        if workflow.evaluate_trigger_conditions(evt):
            triggered_workflows.append(workflow)

    return triggered_workflows
