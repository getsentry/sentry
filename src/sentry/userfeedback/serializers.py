from typing import Any, List, Optional, TypedDict

from sentry.api.serializers.base import Serializer, register
from sentry.userfeedback.models import UserFeedback


class UserFeedbackResponseType(TypedDict):
    dateAdded: str
    replayId: Optional[str]
    url: Optional[str]
    errorIds: List[str]
    traceIds: List[str]
    feedbackText: str
    context: Optional[Any]


@register(UserFeedback)
class UserFeedbackSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> UserFeedbackResponseType:
        result = {
            "dateAdded": obj.date_added,
            "replayId": obj.replay_id,
            "url": obj.url,
            "errorIds": obj.error_ids,
            "traceIds": obj.trace_ids,
            "feedbackText": obj.feedback_text,
            "context": obj.context,
        }
        return result
