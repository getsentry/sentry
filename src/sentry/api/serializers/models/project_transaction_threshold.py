from sentry.api.serializers import Serializer, register
from sentry.models import ProjectTransactionThreshold
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThresholdOverride,
)


@register(ProjectTransactionThreshold)
class ProjectTransactionThresholdSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": f"{obj.id}",
            "threshold": f"{obj.threshold}",
            "metric": TRANSACTION_METRICS[obj.metric],
            "projectId": f"{obj.project_id}",
            "editedBy": f"{obj.edited_by_id}",
            "dateUpdated": obj.date_updated,
            "dateAdded": obj.date_added,
        }


@register(ProjectTransactionThresholdOverride)
class ProjectTransactionThresholdOverrideSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": f"{obj.id}",
            "threshold": f"{obj.threshold}",
            "metric": TRANSACTION_METRICS[obj.metric],
            "transaction": obj.transaction,
            "projectId": f"{obj.project_id}",
            "editedBy": f"{obj.edited_by_id}",
            "dateUpdated": obj.date_updated,
            "dateAdded": obj.date_added,
        }
