from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer, seperateActors
from sentry.models import Activity, GroupSubscription, GroupSubscriptionReason
from sentry.utils.functional import extract_lazy_object


class GroupNotesEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def get(self, request, group):
        notes = Activity.objects.filter(
            group=group,
            type=Activity.NOTE,
        ).select_related('user')

        return self.paginate(
            request=request,
            queryset=notes,
            # TODO(dcramer): we want to sort by datetime
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request, group):
        serializer = NoteSerializer(data=request.DATA, context={'group': group})

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = dict(serializer.object)
        mentions = data.pop('mentions', [])
        actorMentions = seperateActors(mentions)
        user_mentions = actorMentions['users']
        team_mentions = actorMentions['teams']

        if Activity.objects.filter(
            group=group,
            type=Activity.NOTE,
            user=request.user,
            data=data,
            datetime__gte=timezone.now() - timedelta(hours=1)
        ).exists():
            return Response(
                '{"detail": "You have already posted that comment."}',
                status=status.HTTP_400_BAD_REQUEST
            )

        GroupSubscription.objects.subscribe(
            group=group,
            user=request.user,
            reason=GroupSubscriptionReason.comment,
        )

        subscribed_user_ids = set()
        if user_mentions:
            for user in user_mentions:
                GroupSubscription.objects.subscribe(
                    group=group,
                    user=user,
                    reason=GroupSubscriptionReason.mentioned,
                )
                subscribed_user_ids.add(user.id)

        if team_mentions:
            for team in team_mentions:
                for user in [member.user for member in team.member_set
                             if member.user.id not in subscribed_user_ids]:
                    GroupSubscription.objects.subscribe(
                        group=group,
                        user=user,
                        reason=GroupSubscriptionReason.team_mentioned,
                    )
                    subscribed_user_ids.add(user.id)

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.NOTE,
            user=extract_lazy_object(request.user),
            data=data,
        )

        activity.send_notification()

        return Response(serialize(activity, request.user), status=201)
