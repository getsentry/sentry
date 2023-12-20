from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer
from sentry.models.activity import Activity
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import comment_created
from sentry.types.activity import ActivityType


@region_silo_endpoint
class GroupNotesEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, group) -> Response:
        notes = Activity.objects.filter(group=group, type=ActivityType.NOTE.value)

        return self.paginate(
            request=request,
            queryset=notes,
            paginator_cls=DateTimePaginator,
            order_by="-datetime",
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request: Request, group) -> Response:
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

        if Activity.objects.filter(
            group=group,
            type=ActivityType.NOTE.value,
            user_id=request.user.id,
            data=data,
            datetime__gte=timezone.now() - timedelta(hours=1),
        ).exists():
            return Response(
                '{"detail": "You have already posted that comment."}',
                status=status.HTTP_400_BAD_REQUEST,
            )

        GroupSubscription.objects.subscribe(
            group=group, subscriber=request.user, reason=GroupSubscriptionReason.comment
        )

        activity = Activity.objects.create_group_activity(
            group, ActivityType.NOTE, user_id=request.user.id, data=data
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
        return Response(serialize(activity, request.user), status=201)
