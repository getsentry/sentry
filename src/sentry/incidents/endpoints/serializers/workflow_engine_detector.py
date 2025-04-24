from datetime import datetime

from sentry.api.serializers import Serializer
from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
from sentry.workflow_engine.models import Detector


class WorkflowEngineDetectorSerializer(Serializer):
    def serialize(self, obj: Detector, attrs, user, **kwargs) -> AlertRuleSerializerResponse:
        # TODO: Implement this
        return {
            "id": "-2",
            "name": "Test Alert Rule",
            "organizationId": "-2",
            "status": 1,
            "query": "test",
            "aggregate": "test",
            "timeWindow": 1,
            "resolution": 1,
            "thresholdPeriod": 1,
            "triggers": [
                {
                    "id": "-1",
                    "status": 1,
                    "dateModified": datetime.now(),
                    "dateCreated": datetime.now(),
                }
            ],
            "dateModified": datetime.now(),
            "dateCreated": datetime.now(),
            "createdBy": {},
            "description": "test",
            "detectionType": "test",
        }
