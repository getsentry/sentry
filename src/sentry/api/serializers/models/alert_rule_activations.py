from datetime import datetime
from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.incidents.models.alert_rule_activations import AlertRuleActivations


class AlertRuleActivationsResponse(TypedDict):
    id: str
    alertRuleId: str
    dateCreated: datetime
    finishedAt: datetime
    metricValue: int
    querySubscriptionId: str
    isComplete: bool


@register(AlertRuleActivations)
class AlertRuleActivationsSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> AlertRuleActivationsResponse:
        return {
            "id": str(obj.id),
            "alertRuleId": str(obj.alert_rule_id),
            "dateCreated": obj.date_added,
            "finishedAt": obj.finished_at,
            "metricValue": obj.metric_value,
            "querySubscriptionId": str(obj.query_subscription_id),
            "isComplete": obj.is_complete(),
        }
