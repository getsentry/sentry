from typing import Any

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.base import serialize
from sentry.models.notificationhistory import NotificationHistory
from sentry.models.project import Project


@register(NotificationHistory)
class OutgoingNotificationHistorySerializer(Serializer):
    def get_attrs(self, item_list, **kwargs):
        attrs = {}
        project_ids = [
            item.content.get("project_id")
            for item in item_list
            if item.content.get("project_id") is not None
        ]
        projects = serialize(Project.objects.filter(id__in=project_ids))
        project_map = {p["id"]: p for p in projects}
        for item in item_list:
            project_id = item.content.get("project_id")
            if project_id in project_map:
                attrs[item] = {"project": project_map[project_id]}
        return attrs

    def serialize(self, obj: NotificationHistory, attrs, user, **kwargs) -> dict[str, Any]:
        return {
            "id": obj.id,
            "title": obj.title,
            "description": obj.description,
            "status": obj.status,
            "source": obj.source,
            "content": obj.content,
            "project": attrs.get("project"),
            "team": serialize(obj.team) if obj.team else None,
            "user_id": obj.user_id,
            "date_added": obj.date_added,
            "date_updated": obj.date_added,
        }
