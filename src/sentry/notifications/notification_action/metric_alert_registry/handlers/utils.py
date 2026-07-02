from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.incident import (
    IncidentSerializerResponse,
)
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineIncidentSerializer,
)
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
    DetectorSerializer,
    DetectorSerializerResponse,
)
from sentry.workflow_engine.models import Detector


def get_detector_serializer(detector: Detector) -> DetectorSerializerResponse:
    return serialize(detector, None, DetectorSerializer())


def get_incident_serializer(open_period: GroupOpenPeriod) -> IncidentSerializerResponse:
    return serialize(open_period, None, WorkflowEngineIncidentSerializer())
