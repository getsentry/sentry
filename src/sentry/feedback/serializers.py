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
    sdk: Any
    contact_email: str
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


def transform_tags(tags):
    return {}


def shim_issue_to_feedback_response(issue):
    return {
        "browser": issue.get("browser", {}),
        "locale": issue.get("locale", {}),
        "tags": transform_tags(issue.get("tags", {})),
        "device": issue.get("device", {}),
        "os": issue.get("os", {}),
        "user": issue.get("user", {}),
        "replay_id": issue.get("replay_id", None),
        "dist": issue.get("dist", None),
        "sdk": issue.get("sdk", {}),
        "contact_email": issue.get("metadata", {}).get("contact_email", None),
        "environment": issue.get("environment", None),
        "feedback_id": str(issue.get("id", "")).replace("-", ""),
        "message": issue.get("metadata", {}).get("message", None),
        "platform": issue.get("platform", None),
        "project_id": issue.get("project", {}).get("id", None),
        "release": issue.get("release", None),
        "status": issue.get("status", "unresolved"),
        "timestamp": issue.get("timestamp", None),
        "url": issue.get("feedback", {}).get("url", ""),
    }


def shim_event_to_feedback_response(event):
    return {
        "browser": event.get("browser", {}),
        "locale": event.get("locale", {}),
        "tags": transform_tags(event.get("tags", {})),
        "device": event.get("device", {}),
        "os": event.get("os", {}),
        "user": event.get("user", {}),
        "replay_id": event.get("replay_id", None),
        "dist": event.get("dist", None),
        "sdk": event.get("sdk", {}),
        "contact_email": event.get("occurrence", {})
        .get("evidenceData", {})
        .get("contactEmail", None),
        "environment": event.get("environment", None),
        "feedback_id": str(event.get("id", "")).replace("-", ""),
        "message": event.get("occurrence", {}).get("evidenceData", {}).get("message", None),
        "platform": event.get("platform", None),
        "project_id": event.get("project", {}).get("id", None),
        "release": event.get("release", None),
        "status": event.get("status", "unresolved"),
        "timestamp": event.get("timestamp", None),
        "url": event.get("feedback", {}).get("url", "example.com"),
    }
