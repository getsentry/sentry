from __future__ import absolute_import

import itertools

from collections import defaultdict
from django.conf import settings

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (
    OrganizationAccessRequest, OrganizationMemberTeam, Project, ProjectStatus,
    Team
)


@register(Team)
class TeamSerializer(Serializer):
    def get_attrs(self, item_list, user):
        if user.is_active_superuser() or settings.SENTRY_PUBLIC:
            inactive_memberships = frozenset(
                OrganizationMemberTeam.objects.filter(
                    team__in=item_list,
                    organizationmember__user=user,
                    is_active=False,
                ).values_list('team', flat=True)
            )
            memberships = frozenset([
                t.id for t in item_list
                if t.id not in inactive_memberships
            ])
        elif user.is_authenticated():
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

        result = {}
        for team in item_list:
            result[team] = {
                'pending_request': team.id in access_requests,
                'is_member': team.id in memberships,
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
        d['projects'] = attrs['projects']
        return d
