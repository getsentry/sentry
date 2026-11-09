from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Annotated, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from sentry import quotas
from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.project import Project
from sentry.models.userreport import UserReport
from sentry.search.eap.occurrences.query_utils import build_event_id_in_filter
from sentry.services import eventstore
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.eventuser import EventUser, SerializedEventUser


class UserReportEvent(TypedDict):
    id: Annotated[str, ApiDescription("ID of the event the feedback is attached to")]
    eventID: Annotated[str, ApiDescription("ID of the event the feedback is attached to")]


class UserReportSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the feedback")]
    eventID: Annotated[str, ApiDescription("ID of the event the feedback is attached to")]
    name: Annotated[
        str | None,
        ApiDescription(
            "Name of the user who submitted the feedback. Falls back to the feedback's email address, then to the event user's name"
        ),
    ]
    email: Annotated[
        str | None,
        ApiDescription(
            "Email address of the user who submitted the feedback. Falls back to the event user's email address"
        ),
    ]
    comments: Annotated[str, ApiDescription("Comments the user submitted")]
    dateCreated: Annotated[datetime, ApiDescription("When the feedback was submitted (ISO 8601)")]
    user: Annotated[
        SerializedEventUser | None,
        ApiDescription(
            "User recorded on the feedback's event. Null when the event isn't found or has no user"
        ),
    ]
    event: Annotated[UserReportEvent, ApiDescription("Event the feedback is attached to")]


class _EventUser(TypedDict):
    event_user: EventUser | dict[None, None]
    group: NotRequired[dict[str, object] | None]


@register(UserReport)
class UserReportSerializer(Serializer[UserReportSerializerResponse]):
    def get_attrs(
        self,
        item_list: Sequence[UserReport],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[UserReport, _EventUser]:
        attrs: dict[UserReport, _EventUser] = {}

        project = Project.objects.get(id=item_list[0].project_id)
        retention = quotas.backend.get_event_retention(organization=project.organization)

        event_ids = [item.event_id for item in item_list]
        events = eventstore.backend.get_events(
            filter=eventstore.Filter(
                event_ids=event_ids,
                project_ids=[project.id],
                start=timezone.now() - timedelta(days=retention) if retention else None,
            ),
            eap_conditions=build_event_id_in_filter(event_ids),
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

    def serialize(
        self,
        obj: UserReport,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> UserReportSerializerResponse:
        # TODO(dcramer): add in various context from the event
        # context == user / http / extra interfaces

        name: str | None = obj.name or obj.email
        email: str | None = obj.email
        serialized_user: SerializedEventUser | None = None
        if attrs["event_user"]:
            event_user = attrs["event_user"]
            if isinstance(event_user, EventUser):
                name = name or event_user.name
                email = email or event_user.email
                serialized_user = event_user.serialize()
        return {
            "id": str(obj.id),
            "eventID": obj.event_id,
            "name": name,
            "email": email,
            "comments": obj.comments,
            "dateCreated": obj.date_added,
            "user": serialized_user,
            "event": {"id": obj.event_id, "eventID": obj.event_id},
        }
