from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer
from sentry.api.serializers.rest_framework.mentions import extract_user_ids_from_mentions
from sentry.models import Activity, GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.utils.functional import extract_lazy_object


class GroupNotesEndpoint(GroupEndpoint):
    def get(self, request, group):
        notes = Activity.objects.filter(group=group, type=Activity.NOTE).select_related("user")

        return self.paginate(
            request=request,
            queryset=notes,
            # TODO(dcramer): we want to sort by datetime
            order_by="-id",
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request, group):
        serializer = NoteSerializer(
            data=request.data,
            context={"organization_id": group.organization.id, "projects": [group.project]},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = dict(serializer.validated_data)

        mentions = data.pop("mentions", [])

        if Activity.objects.filter(
            group=group,
            type=Activity.NOTE,
            user=request.user,
            data=data,
            datetime__gte=timezone.now() - timedelta(hours=1),
        ).exists():
            return Response(
                '{"detail": "You have already posted that comment."}',
                status=status.HTTP_400_BAD_REQUEST,
            )

        GroupSubscription.objects.subscribe(
            group=group, user=request.user, reason=GroupSubscriptionReason.comment
        )

        mentioned_users = extract_user_ids_from_mentions(group.organization.id, mentions)
        GroupSubscription.objects.bulk_subscribe(
            group=group, user_ids=mentioned_users["users"], reason=GroupSubscriptionReason.mentioned
        )

        GroupSubscription.objects.bulk_subscribe(
            group=group,
            user_ids=mentioned_users["team_users"],
            reason=GroupSubscriptionReason.team_mentioned,
        )

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.NOTE,
            user=extract_lazy_object(request.user),
            data=data,
        )

        activity.send_notification()

        self.create_external_comment(request, group, activity)
        return Response(serialize(activity, request.user), status=201)
