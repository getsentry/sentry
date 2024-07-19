from datetime import datetime
from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.incidents.models.alert_rule_activations import AlertRuleActivations


class AlertRuleActivationsResponse(TypedDict):
    id: str
    activator: str
    alertRuleId: str
    conditionType: str
    dateCreated: datetime
    finishedAt: datetime
    isComplete: bool
    metricValue: int
    querySubscriptionId: str


@register(AlertRuleActivations)
class AlertRuleActivationsSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> AlertRuleActivationsResponse:
        return {
            "id": str(obj.id),
            "activator": obj.activator,
            "alertRuleId": str(obj.alert_rule_id),
            "conditionType": str(obj.condition_type),
            "dateCreated": obj.date_added,
            "finishedAt": obj.finished_at,
            "isComplete": obj.is_complete(),
            "metricValue": obj.metric_value,
            "querySubscriptionId": str(obj.query_subscription_id),
        }
