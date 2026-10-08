import logging
from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.activity import ActivitySerializerResponse
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.action_log import action_context_scope, resolve_action_source
from sentry.issues.action_log.read_metrics import (
    ActivityReadFallbackReason,
    ActivityReadResult,
    activity_read_endpoint,
    record_activity_read,
)
from sentry.issues.action_log.types import (
    GroupActionActor,
    GroupActionType,
)
from sentry.issues.derived.gate import should_serve_action_log_activity
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import comment_created
from sentry.types.activity import ActivityType
from sentry.utils.action_log.activity_translator import activity_action_idempotency_key

logger = logging.getLogger(__name__)


class GroupNoteSerializerResponse(ActivitySerializerResponse):
    source: str | None


@cell_silo_endpoint
class GroupNotesEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        responses={
            200: inline_sentry_response_serializer(
                "ListGroupNotes", list[GroupNoteSerializerResponse]
            )
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-notes",
        url_names=["sentry-api-0-group-notes"],
    )
    def get(self, request: Request, group: Group) -> Response:
        notes = Activity.objects.filter(group=group, type=ActivityType.NOTE.value)

        def serialize_notes(notes: list[Activity]) -> list[GroupNoteSerializerResponse]:
            if not notes:
                return []

            # Activity owns current comment state. GAL only enriches this page
            # with source metadata; missing or delayed events cannot hide notes.
            sources = dict(
                GroupActionLogEntry.objects.filter(
                    group_id=group.id,
                    project_id=group.project_id,
                    type=GroupActionType.COMMENT.value,
                    idempotency_key__in=[activity_action_idempotency_key(note) for note in notes],
                ).values_list("idempotency_key", "source")
            )
            serialized_notes: list[ActivitySerializerResponse] = serialize(notes, request.user)
            return [
                {
                    **item,
                    # Retain the data alias previously returned by GAL reads.
                    "data": {**item["data"], "comment_id": note.id},
                    "source": sources.get(activity_action_idempotency_key(note)),
                }
                for note, item in zip(notes, serialized_notes)
            ]

        response = self.paginate(
            request=request,
            queryset=notes,
            paginator_cls=DateTimePaginator,
            order_by="-datetime",
            on_results=serialize_notes,
        )
        record_activity_read(activity_read_endpoint(request), ActivityReadResult.ACTIVITY)
        return response

    @extend_schema(
        request=NoteSerializer,
        responses={
            201: inline_sentry_response_serializer("CreateGroupNote", ActivitySerializerResponse)
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-notes",
        url_names=["sentry-api-0-group-notes"],
    )
    def post(self, request: Request, group: Group) -> Response:
        if not request.user.is_authenticated:
            raise PermissionDenied(detail="Key doesn't have permission to create Note")

        serializer = NoteSerializer(
            data=request.data,
            context={
                "organization": group.organization,
                "organization_id": group.organization.id,
                "projects": [group.project],
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = dict(serializer.validated_data)
        if "mentions" in data:
            data["mentions"] = [m.dict() for m in data["mentions"]]

        if Activity.objects.filter(
            group=group,
            type=ActivityType.NOTE.value,
            user_id=request.user.id,
            data=data,
            datetime__gte=timezone.now() - timedelta(hours=1),
        ).exists():
            return Response(
                {"detail": "You have already posted that comment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        GroupSubscription.objects.subscribe(
            group=group, subscriber=request.user, reason=GroupSubscriptionReason.comment
        )

        with action_context_scope(
            source=resolve_action_source(request),
            actor=GroupActionActor.user(request.user.id),
        ):
            activity = Activity.objects.create_group_activity(
                group=group, type=ActivityType.NOTE, user_id=request.user.id, data=data
            )

            self.create_external_comment(request, group, activity)

        webhook_data = {
            "comment_id": activity.id,
            "timestamp": activity.datetime,
            "comment": activity.data.get("text"),
            "project_slug": activity.project.slug,
        }

        comment_created.send_robust(
            project=group.project,
            user=request.user,
            group=group,
            data=webhook_data,
            sender="post",
        )

        endpoint = activity_read_endpoint(request)
        if should_serve_action_log_activity(group.project, request.user, endpoint=endpoint):
            entry = GroupActionLogEntry.objects.filter(
                group_id=group.id,
                idempotency_key=activity_action_idempotency_key(activity),
            ).first()
            if entry:
                record_activity_read(endpoint, ActivityReadResult.GAL)
                return Response(serialize(entry, request.user), status=201)
            record_activity_read(
                endpoint,
                ActivityReadResult.FELL_BACK,
                ActivityReadFallbackReason.EMPTY_LOG,
            )
            logger.info("group_notes.groupactionlogentry.not_found", extra={"group_id": group.id})

        return Response(serialize(activity, request.user), status=201)
