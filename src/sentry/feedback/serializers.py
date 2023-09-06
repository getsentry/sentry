from typing import Any, List, Optional, TypedDict

from sentry.api.serializers.base import Serializer, register
from sentry.user_feedback.models import UserFeedback


class UserFeedbackResponseType(TypedDict):
    date_added: str
    replay_id: Optional[str]
    url: Optional[str]
    error_ids: List[str]
    trace_ids: List[str]
    feedback_text: str
    context: Optional[Any]


@register(UserFeedback)
class UserFeedbackSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> UserFeedbackResponseType:
        result = {
            "date_added": obj.date_added,
            "replay_id": obj.replay_id,
            "url": obj.url,
            "error_ids": obj.error_ids,
            "trace_ids": obj.trace_ids,
            "feedback_text": obj.feedback_text,
            "context": obj.context,
        }
        return result
