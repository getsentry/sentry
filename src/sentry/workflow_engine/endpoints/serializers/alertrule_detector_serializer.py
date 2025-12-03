from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.workflow_engine.models import AlertRuleDetector


class AlertRuleDetectorSerializerResponse(TypedDict):
    ruleId: str | None
    alertRuleId: str | None
    detectorId: str


@register(AlertRuleDetector)
class AlertRuleDetectorSerializer(Serializer):
    def serialize(
        self, obj: AlertRuleDetector, attrs: Mapping[str, Any], user, **kwargs
    ) -> AlertRuleDetectorSerializerResponse:
        return {
            "ruleId": str(obj.rule_id) if obj.rule_id else None,
            "alertRuleId": str(obj.alert_rule_id) if obj.alert_rule_id else None,
            "detectorId": str(obj.detector.id),
        }
