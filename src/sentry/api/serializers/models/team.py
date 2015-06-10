from __future__ import absolute_import

import itertools

from collections import defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (
    OrganizationAccessRequest, OrganizationMemberType, Project, ProjectStatus,
    Team
)


@register(Team)
class TeamSerializer(Serializer):
    def get_attrs(self, item_list, user):
        organization = item_list[0].organization
        # TODO(dcramer): in most cases this data should already be in memory
        # and we're simply duplicating efforts here
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
            try:
                access_type = team_map[team.id].access_type
            except KeyError:
                access_type = None

            result[team] = {
                'access_type': access_type,
                'pending_request': team.id in access_requests,
            }
        return result

    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
            'isMember': attrs['access_type'] is not None,
            'isPending': attrs['pending_request'],
            'permission': {
                'owner': attrs['access_type'] <= OrganizationMemberType.OWNER,
                'admin': attrs['access_type'] <= OrganizationMemberType.ADMIN,
            }
        }
        return d


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
