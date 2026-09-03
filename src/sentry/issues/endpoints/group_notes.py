import logging
from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
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
from sentry.issues.action_log.types import (
    CommentDeleteAction,
    CommentEditAction,
    GroupActionActor,
    GroupActionType,
)
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


@cell_silo_endpoint
class GroupNotesEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        responses={
            200: inline_sentry_response_serializer(
                "ListGroupNotes", list[ActivitySerializerResponse]
            )
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-notes",
        url_names=["sentry-api-0-group-notes"],
    )
    def get(self, request: Request, group: Group) -> Response:
        if features.has("projects:issue-action-log-activity", group.project, actor=request.user):
            edit_entries = GroupActionLogEntry.objects.filter(
                group_id=group.id, type=GroupActionType.COMMENT_EDIT.value
            ).order_by("-date_added", "-id")

            # A COMMENT_EDIT points at the GALE id of the original COMMENT it
            # supersedes; entries are newest-first, so keep the latest edit's
            # text per comment.
            latest_edit_text_by_comment: dict[int, str | None] = {}
            for edit in edit_entries:
                action = edit.action
                if isinstance(action, CommentEditAction):
                    latest_edit_text_by_comment.setdefault(action.comment_id, action.text)

            # A COMMENT_DELETE points at the GALE id of the COMMENT it removes;
            # GALE is append-only, so exclude those so deleted notes drop out.
            deleted_comment_ids = {
                action.comment_id
                for entry in GroupActionLogEntry.objects.filter(
                    group_id=group.id, type=GroupActionType.COMMENT_DELETE.value
                )
                if isinstance(action := entry.action, CommentDeleteAction)
            }

            entries = GroupActionLogEntry.objects.filter(
                group_id=group.id, type=GroupActionType.COMMENT.value
            ).exclude(id__in=deleted_comment_ids)

            def serialize_with_edits(comment_entries: list[GroupActionLogEntry]) -> list[object]:
                # An edit doesn't mutate the original COMMENT entry, so re-derive
                # the current text from the latest COMMENT_EDIT before serializing.
                for entry in comment_entries:
                    if entry.id in latest_edit_text_by_comment:
                        entry.data = {
                            **(entry.data or {}),
                            "text": latest_edit_text_by_comment[entry.id],
                        }
                return serialize(comment_entries, request.user)

            return self.paginate(
                request=request,
                queryset=entries,
                paginator_cls=DateTimePaginator,
                order_by="-date_added",
                on_results=serialize_with_edits,
            )

        notes = Activity.objects.filter(group=group, type=ActivityType.NOTE.value)

        return self.paginate(
            request=request,
            queryset=notes,
            paginator_cls=DateTimePaginator,
            order_by="-datetime",
            on_results=lambda x: serialize(x, request.user),
        )

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

        if features.has("projects:issue-action-log-activity", group.project, actor=request.user):
            entry = GroupActionLogEntry.objects.filter(
                group_id=group.id,
                idempotency_key=activity_action_idempotency_key(activity),
            ).first()
            if entry:
                return Response(serialize(entry, request.user), status=201)
            logger.info("group_notes.groupactionlogentry.not_found", extra={"group_id": group.id})

        return Response(serialize(activity, request.user), status=201)
