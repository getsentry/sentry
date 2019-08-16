from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.incidents.models import AlertRule


@register(AlertRule)
class AlertRuleSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "name": obj.name,
            "projectId": six.text_type(obj.project_id),
            "status": obj.status,
            "thresholdType": obj.threshold_type,
            "dataset": obj.dataset,
            "query": obj.query,
            "aggregations": [agg for agg in obj.aggregations],
            "timeWindow": obj.time_window,
            "resolution": obj.resolution,
            "alertThreshold": obj.alert_threshold,
            "resolveThreshold": obj.resolve_threshold,
            "thresholdPeriod": obj.threshold_period,
            "dateModified": obj.date_modified,
            "dateAdded": obj.date_added,
        }
