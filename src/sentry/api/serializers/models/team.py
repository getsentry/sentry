from __future__ import absolute_import

import itertools

from collections import defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (
    OrganizationAccessRequest, Project, ProjectStatus, Team
)


@register(Team)
class TeamSerializer(Serializer):
    def get_attrs(self, item_list, user):
        organization = item_list[0].organization
        # TODO(dcramer): kill this off when we fix OrganizaitonMemberTeam
        team_map = dict(
            (t.id, t) for t in Team.objects.get_for_user(
                organization=organization,
                user=user,
            )
        )

        if user.is_authenticated():
            access_requests = frozenset(
                OrganizationAccessRequest.objects.filter(
                    team__in=item_list,
                    member__user=user,
                ).values_list('team')
            )
        else:
            access_requests = frozenset()

        result = {}
        for team in item_list:
            result[team] = {
                'pending_request': team.id in access_requests,
                'is_member': team.id in team_map,
            }
        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
            'isMember': attrs['is_member'],
            'isPending': attrs['pending_request'],
        }


class TeamWithProjectsSerializer(TeamSerializer):
    def get_attrs(self, item_list, user):
        project_qs = list(Project.objects.filter(
            team__in=item_list,
            status=ProjectStatus.VISIBLE,
        ).order_by('name', 'slug'))

        project_map = defaultdict(list)
        for project, data in itertools.izip(project_qs, serialize(project_qs, user)):
            project_map[project.team_id].append(data)

        result = super(TeamWithProjectsSerializer, self).get_attrs(item_list, user)
        for team in item_list:
            result[team]['projects'] = project_map[team.id]
        return result

    def serialize(self, obj, attrs, user):
        d = super(TeamWithProjectsSerializer, self).serialize(obj, attrs, user)
        # project lists are only available if you're a member
        if d['isMember']:
            d['projects'] = attrs['projects']
        return d
