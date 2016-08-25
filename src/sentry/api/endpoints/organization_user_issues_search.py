from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.models import EventUser, Group, GroupTagValue, Project


class OrganizationUserIssuesSearchEndpoint(OrganizationEndpoint):

    def get(self, request, organization):
        email = request.GET.get('email')

        if email is None:
            return Response(status=400)

        limit = request.GET.get('limit', 100)

        team_list = list(request.access.teams)
        projects = Project.objects.filter(
            team__in=team_list,
        )

        event_users = EventUser.objects.filter(email=email,
                                               project_id__in=[p.id for p in projects])

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
