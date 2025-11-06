from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.incidents.endpoints.serializers.incident import (
    DetailedIncidentSerializerResponse,
    IncidentSerializerResponse,
)
from sentry.incidents.endpoints.serializers.workflow_engine_detector import (
    WorkflowEngineDetectorSerializer,
)
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineDetailedIncidentSerializer,
    WorkflowEngineIncidentSerializer,
)
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
    DetectorSerializer,
    DetectorSerializerResponse,
)
from sentry.workflow_engine.models import Detector


def get_alert_rule_serializer(detector: Detector) -> AlertRuleSerializerResponse:
    return serialize(detector, None, WorkflowEngineDetectorSerializer())


def get_detector_serializer(detector: Detector) -> DetectorSerializerResponse:
    return serialize(detector, None, DetectorSerializer())


# TODO(mifu67): These take an open period, get the incident, and call the incident
# serializer on the incident. They will need to be replaced.
def get_detailed_incident_serializer(
    open_period: GroupOpenPeriod,
) -> DetailedIncidentSerializerResponse:
    return serialize(open_period, None, WorkflowEngineDetailedIncidentSerializer())


def get_incident_serializer(open_period: GroupOpenPeriod) -> IncidentSerializerResponse:
    return serialize(open_period, None, WorkflowEngineIncidentSerializer())
