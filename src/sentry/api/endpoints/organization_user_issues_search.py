from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.models import (EventUser, Group, GroupTagValue, OrganizationMemberTeam, Project)


class OrganizationUserIssuesSearchEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        email = request.GET.get('email')

        if email is None:
            return Response(status=400)

        limit = request.GET.get('limit', 100)

        # limit to only teams user has opted into
        project_ids = list(
            Project.objects.filter(
                team__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__user=request.user,
                    organizationmember__organization=organization,
                    is_active=True,
                ).values('team'),
            ).values_list('id', flat=True)[:1000]
        )

        event_users = EventUser.objects.filter(
            email=email,
            project_id__in=project_ids,
        )[:1000]

        project_ids = list(set([e.project_id for e in event_users]))

        group_ids = list(
            GroupTagValue.objects.filter(
                key='sentry:user',
                value__in=[eu.tag_value for eu in event_users],
                project_id__in=project_ids,
            ).order_by('-last_seen').values_list('group_id', flat=True)[:limit]
        )

        groups = Group.objects.filter(
            id__in=group_ids,
        ).order_by('-last_seen')[:limit]

        context = serialize(list(groups), request.user, StreamGroupSerializer(stats_period=None))

        return Response(context)
