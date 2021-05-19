from sentry.api.serializers import Serializer, register
from sentry.models import ProjectTransactionThreshold
from sentry.models.transaction_threshold import TRANSACTION_METRICS


@register(ProjectTransactionThreshold)
class ProjectTransactionThresholdSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "threshold": str(obj.threshold),
            "metric": TRANSACTION_METRICS[obj.metric],
            "projectId": str(obj.project_id),
            "editedBy": str(obj.edited_by_id),
            "dateUpdated": obj.date_updated,
        }
