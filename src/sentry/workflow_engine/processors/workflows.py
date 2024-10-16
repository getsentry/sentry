from django.db.models import Prefetch

from sentry.workflow_engine.models import DataPacket, Detector, Workflow


class DetectorResult:
    pass


# TODO - see if this Detector can be typed to ensure there is a DetectorState object as well
def process_workflows(
    data: DataPacket,
    detector_results: list[tuple[Detector, list[DetectorResult]]],
):
    detector_ids = [detector.id for detector, _ in detector_results]
    detector_results_lookup = {detector.id: results for detector, results in detector_results}

    # get the workflows associated with the detectors that have state changes, and get their when_condition_group
    associated_workflows = Workflow.objects.filter(
        detectorworkflow__detector__in=detector_ids
    ).prefetch_related(Prefetch("when_condition_group"))

    # print("associated workflows", associated_workflows)
    # import pdb
    # pdb.set_trace()

    for workflow in associated_workflows:
        results = detector_results_lookup[workflow.detector.id]
        # print("yay", workflow, results)

        # check to see if any of the conditions in the when_condition_group are met for the detector
        #   if they are, get the associated workflow actions
        #   call workflow.evaluate(data, detector) for each
        # workflow.when_condition_group

    # iterate over the workflow
    #   check the base when to ensure the state emitted by the detector matches
    #   call workflow.evaluate(data, detector) for each workflow

    return results
