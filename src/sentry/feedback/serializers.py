from typing import Any, Optional, TypedDict

from sentry.api.serializers.base import Serializer, register
from sentry.feedback.models import Feedback


class FeedbackResponseType(TypedDict):
    browser: Optional[Any]
    locale: Optional[Any]
    tags: Optional[Any]
    device: Optional[Any]
    os: Optional[Any]
    user: Optional[Any]
    replay_id: Optional[str]
    url: Optional[str]
    dist: Optional[str]
    environment: Optional[str]
    release: Optional[str]
    name: Optional[str]
    contact_email: Optional[str]
    sdk: Any
    feedback_id: str
    message: str
    platform: str
    project_id: str
    status: str
    timestamp: str


@register(Feedback)
class FeedbackSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> FeedbackResponseType:
        if obj.environment:
            env = obj.environment.name
        else:
            env = "production"

        res: FeedbackResponseType = {
            "browser": obj.data.get("browser") or {},
            "locale": obj.data.get("locale") or {},
            "tags": obj.data.get("tags") or {},
            "device": obj.data.get("device") or {},
            "os": obj.data.get("os") or {},
            "user": obj.data.get("user") or {},
            "replay_id": obj.replay_id,
            "dist": obj.data.get("dist"),
            "sdk": obj.data.get("sdk"),
            "contact_email": obj.data.get("feedback").get("contact_email"),
            "name": obj.data.get("feedback").get("name"),
            "environment": env,
            "feedback_id": str(obj.feedback_id).replace("-", ""),
            "message": obj.message,
            "platform": obj.data.get("platform"),
            "project_id": obj.project_id,
            "release": obj.data.get("release"),
            "status": "unresolved",
            "timestamp": obj.date_added,
            "url": obj.url,
        }
        return res
