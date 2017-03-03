from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.models import (
    EventUser, Group, GroupTagValue, OrganizationMember,
    OrganizationMemberTeam, Project, Team
)


class OrganizationUserIssuesSearchEndpoint(OrganizationEndpoint):

    def get(self, request, organization):
        email = request.GET.get('email')

        if email is None:
            return Response(status=400)

        limit = request.GET.get('limit', 100)

        # limit to only teams user has opted into
        member = OrganizationMember.objects.get(user=request.user,
                                                organization=organization)
        teams = Team.objects.filter(
            id__in=OrganizationMemberTeam.objects.filter(
                organizationmember=member,
                is_active=True,
            ).values('team')
        )

        projects = Project.objects.filter(
            team__in=list(teams),
        )

        event_users = EventUser.objects.filter(email=email,
                                               project_id__in=[p.id for p in projects])[:1000]

        projects = list(set([e.project_id for e in event_users]))

        tag_values = [eu.tag_value for eu in event_users]
        tags = GroupTagValue.objects.filter(key='sentry:user',
                                            value__in=tag_values,
                                            project_id__in=projects)

        group_ids = tags.values_list('group_id', flat=True)

        groups = Group.objects.filter(id__in=group_ids,
                                      project_id__in=projects).order_by('-last_seen')[:limit]

        context = serialize(
            list(groups), request.user, StreamGroupSerializer(
                stats_period=None
            )
        )

        response = Response(context)

        return response
