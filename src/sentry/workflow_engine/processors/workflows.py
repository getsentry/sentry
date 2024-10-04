from typing import Protocol

from django.db.models import Prefetch

from sentry.workflow_engine.models import Detector, Workflow


# TODO - get the data packet from the models once merged
class DataPacket(Protocol):
    query_id: int


# TODO - see if this Detector can be typed to ensure there is a DetectorState object as well
def process_workflow(data: DataPacket, detectors: list[Detector]):
    detector_ids = {detector.id for detector in detectors}

    # get the workflows associated with the detectors that have state changes, and get their when_condition_group
    associated_workflows = Workflow.objects.filter(
        detectorworkflow__detector__in=detector_ids
    ).prefetch_related(Prefetch("when_condition_group"))

    print(associated_workflows)

    import pdb

    pdb.set_trace()

    for workflow in associated_workflows:
        # check to see if any of the conditions in the when_condition_group are met for the detector
        #   if they are, get the associated workflow actions
        #   call workflow.evaluate(data, detector) for each
        workflow.when_condition_group

    # iterate over the workflow
    #   check the base when to ensure the state emitted by the detector matches
    #   call workflow.evaluate(data, detector) for each workflow


def process_workflows(data: list[tuple[DataPacket, list[Detector]]]):
    # improve batching here, this is an N+1 query
    for packet, detectors in data:
        process_workflow(packet, detectors)
