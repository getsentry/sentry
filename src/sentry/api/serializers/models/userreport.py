from datetime import timedelta
from typing import Any, TypedDict

from django.utils import timezone

from sentry import eventstore, quotas
from sentry.api.serializers import Serializer, register, serialize
from sentry.eventstore.models import Event
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.userreport import UserReport
from sentry.snuba.dataset import Dataset
from sentry.utils.eventuser import EventUser, SerializedEventUser


class UserReportEvent(TypedDict):
    id: str
    eventID: str


class UserReportSerializerResponse(TypedDict):
    id: str
    eventID: str
    name: str | None
    email: str | None
    comments: str
    dateCreated: str
    user: SerializedEventUser | None
    event: UserReportEvent


class UserReportWithGroupSerializerResponse(UserReportSerializerResponse):
    issue: dict[str, Any]


class _EventUser(TypedDict):
    event_user: EventUser | dict[None, None]


@register(UserReport)
class UserReportSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        attrs: dict[str, _EventUser] = {}

        project = Project.objects.get(id=item_list[0].project_id)
        retention = quotas.backend.get_event_retention(organization=project.organization)

        events = eventstore.backend.get_events(
            filter=eventstore.Filter(
                event_ids=[item.event_id for item in item_list],
                project_ids=[project.id],
                start=timezone.now() - timedelta(days=retention) if retention else None,
            ),
            referrer="UserReportSerializer.get_attrs",
            dataset=Dataset.Events,
            tenant_ids={"organization_id": project.organization_id},
        )

        events_dict: dict[str, Event] = {event.event_id: event for event in events}
        for item in item_list:
            attrs[item] = {
                "event_user": (
                    EventUser.from_event(events_dict[item.event_id])
                    if events_dict.get(item.event_id)
                    else {}
                )
            }

        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> UserReportSerializerResponse:
        # TODO(dcramer): add in various context from the event
        # context == user / http / extra interfaces

        name = obj.name or obj.email
        email = obj.email
        user = None
        if attrs["event_user"]:
            event_user = attrs["event_user"]
            if isinstance(event_user, EventUser):
                name = name or event_user.name
                email = email or event_user.email
                user = event_user.serialize()
        return {
            "id": str(obj.id),
            "eventID": obj.event_id,
            "name": name,
            "email": email,
            "comments": obj.comments,
            "dateCreated": obj.date_added,
            "user": user,
            "event": {"id": obj.event_id, "eventID": obj.event_id},
        }


class UserReportWithGroupSerializer(UserReportSerializer):
    def __init__(self, environment_func=None):
        self.environment_func = environment_func

    def get_attrs(self, item_list, user, **kwargs):
        from sentry.api.serializers import GroupSerializer

        groups = list(Group.objects.filter(id__in={i.group_id for i in item_list if i.group_id}))
        serialized_groups = {}
        if groups:
            serialized_groups = {
                d["id"]: d
                for d in serialize(
                    groups,
                    user,
                    GroupSerializer(environment_func=self.environment_func),
                )
            }

        attrs = super().get_attrs(item_list, user)
        for item in item_list:
            attrs[item].update(
                {"group": serialized_groups[str(item.group_id)] if item.group_id else None}
            )
        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> UserReportWithGroupSerializerResponse:
        context = super().serialize(obj, attrs, user)
        return {
            **context,
            "issue": attrs["group"],
        }
