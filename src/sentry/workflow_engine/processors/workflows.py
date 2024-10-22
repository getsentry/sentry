from collections import defaultdict

from sentry.workflow_engine.models import (
    DataPacket,
    Detector,
    DetectorEvaluationResult,
    DetectorWorkflow,
    Workflow,
)

DetectorResult = tuple[Detector, list[DetectorEvaluationResult]]


def get_related_workflows_by_result(
    detector_results: list[DetectorResult],
) -> dict[Workflow, list[DetectorResult]]:
    """
    Encapsulates the logic to get related workflows for activated detectors.

    The result is a dictionary where the key is the workflow and the value is a list of
    the detectors and their results. By using a dictionary we can merge repeated workflows
    from multiple detectors.
    """
    detector_results_lookup = {
        detector.id: (detector, results) for detector, results in detector_results
    }
    detector_ids = list(detector_results_lookup.keys())

    detector_workflows = (
        DetectorWorkflow.objects.filter(detector_id__in=detector_ids)
        .select_related("workflow")
        .prefetch_related("workflow__when_condition_group")
    )

    workflow_to_detector_results: dict[Workflow, list[DetectorResult]] = defaultdict(list)

    for detector_workflow in detector_workflows:
        workflow = detector_workflow.workflow
        detector_id = detector_workflow.detector_id
        detector, results = detector_results_lookup.get(detector_id, [])
        workflow_to_detector_results[workflow].append((detector, results))

    return workflow_to_detector_results


def evaluate_workflow_trigger_conditions(
    workflow_to_detector_results: dict[Workflow, list[DetectorResult]]
) -> dict[Workflow, list[DetectorResult]]:
    """
    Take the list of workflows and the detector results, and evaluate the when condition.
    This will evaluate the new state of the detector and compare it to when the workflow
    should trigger.

    This will return a dictionary of the workflows that should evaluate their actions.
    """
    triggered_workflows: dict[Workflow, list[DetectorResult]] = defaultdict(list)

    # Evaluate the when condition group for each workflow, return the list of triggered workflows
    for workflow, detector_and_results in workflow_to_detector_results.items():
        for detector, results in detector_and_results:
            for detector_update in results:
                # TODO - Confirm this is the correct way the state will be sent for all detectors
                new_detector_state = detector_update.state_update_data

                if new_detector_state is None:
                    continue

                new_detector_status = new_detector_state.status

                if workflow.evaluate_when_condition_group(new_detector_status):
                    # TODO - add logger / metrics
                    triggered_workflows[workflow].append((detector, results))

                # decide if we should hardcode resolution here or create a default reslution
                # if we want to hardcode it - TODO here

    return triggered_workflows


def process_workflows(
    data: DataPacket,
    detector_results: list[DetectorResult],
):
    workflow_to_detector_results = get_related_workflows_by_result(detector_results)
    triggered_workflows = evaluate_workflow_trigger_conditions(workflow_to_detector_results)

    # TODO - Add logic to get the actions from the triggered workflows
    #      - Apply filter logic to the actions
    #      - Deduplicate actions that are the same
    #      - Return the list of actions to trigger
    return triggered_workflows
