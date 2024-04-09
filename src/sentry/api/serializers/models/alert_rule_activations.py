from sentry.api.serializers import Serializer, register
from sentry.incidents.models.alert_rule_activations import AlertRuleActivations


@register(AlertRuleActivations)
class AlertRuleActivationsSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "alertRuleId": str(obj.alert_rule_id),
            "dateCreated": obj.date_added,
            "finishedAt": obj.finished_at,
            "metricValue": obj.metric_value,
            "querySubscriptionId": str(obj.query_subscription_id),
            "isComplete": obj.is_complete(),
        }
