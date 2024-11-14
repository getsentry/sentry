from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models import DataPacket, Detector, DetectorWorkflow
from sentry.workflow_engine.types import DetectorPriorityLevel


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
    issue_occurrence = evt.occurrence

    if issue_occurrence is None:
        # If there isn't an occurrence, it's an error event. This will lookup the detector based on the
        # project_id and the type of detector.

        # TODO - Don't hardcode the type as a string, make an enum
        detector_id = Detector.objects.get(project_id=evt.project_id, type="ErrorDetector").id
    else:
        detector_id = issue_occurrence.evidence_data.get("detector_id", None)

    if detector_id is None:
        raise ValueError("Issue Occurence does not have a detector_id")

    # gather all the workflows based on the detector_id
    detector_workflows = DetectorWorkflow.objects.filter(detector_id=detector_id).prefetch_related(
        "workflow"
    )
    workflows = [detector_workflow.workflow for detector_workflow in detector_workflows]
    triggered_workflows = []

    for workflow in workflows:
        # TODO think about what this should evaluate,
        # - detector state, the state of the detector
        # - evt.state?
        # - (issue occurence / error) state?
        # - lookup detector_state?
        # - DetectorEvaluationResult has `result` property

        priority: DetectorPriorityLevel = DetectorPriorityLevel(evt.data["priority"])

        if workflow.evaluate_trigger_conditions(priority):
            triggered_workflows.append(workflow)

    return triggered_workflows
