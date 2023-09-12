from typing import Any, Optional, TypedDict

from sentry.api.serializers.base import Serializer, register
from sentry.feedback.models import Feedback


class FeedbackResponseType(TypedDict):
    date_added: str
    replay_id: Optional[str]
    project_id: str
    url: Optional[str]
    message: str
    data: Optional[Any]
    feedback_id: str


@register(Feedback)
class FeedbackSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> FeedbackResponseType:
        res: FeedbackResponseType = {
            "date_added": obj.date_added,
            "replay_id": obj.replay_id,
            "url": obj.url,
            "message": obj.message,
            "data": obj.data,
            "feedback_id": obj.feedback_id,
            "project_id": obj.project_id,
        }
        return res
