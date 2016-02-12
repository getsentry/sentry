from __future__ import absolute_import

import itertools

from collections import defaultdict

from sentry.app import env
from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (
    OrganizationAccessRequest, OrganizationMemberTeam, Project, ProjectStatus,
    Team
)


@register(Team)
class TeamSerializer(Serializer):
    def get_attrs(self, item_list, user):
        request = env.request
        if user.is_authenticated():
            memberships = frozenset(
                OrganizationMemberTeam.objects.filter(
                    organizationmember__user=user,
                    team__in=item_list,
                    is_active=True,
                ).values_list('team', flat=True)
            )
        else:
            memberships = frozenset()

        if user.is_authenticated():
            access_requests = frozenset(
                OrganizationAccessRequest.objects.filter(
                    team__in=item_list,
                    member__user=user,
                ).values_list('team', flat=True)
            )
        else:
            access_requests = frozenset()

        is_superuser = request.is_superuser() and request.user == user
        result = {}
        for team in item_list:
            is_member = team.id in memberships
            if is_member:
                has_access = True
            elif is_superuser:
                has_access = True
            elif team.organization.flags.allow_joinleave:
                has_access = True
            else:
                has_access = False
            result[team] = {
                'pending_request': team.id in access_requests,
                'is_member': is_member,
                'has_access': has_access,
            }
        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
            'isMember': attrs['is_member'],
            'hasAccess': attrs['has_access'],
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
        d['projects'] = attrs['projects']
        return d
