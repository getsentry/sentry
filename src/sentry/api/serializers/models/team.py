from __future__ import absolute_import

import six

from collections import defaultdict
from six.moves import zip

from sentry.app import env
from sentry.api.serializers import Serializer, register, serialize
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    OrganizationAccessRequest, OrganizationMemberTeam, ProjectStatus,
    ProjectTeam, Team
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

        is_superuser = (request and is_active_superuser(request) and request.user == user)
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
            'id': six.text_type(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
            'isMember': attrs['is_member'],
            'hasAccess': attrs['has_access'],
            'isPending': attrs['pending_request'],
        }


class TeamWithProjectsSerializer(TeamSerializer):
    def get_attrs(self, item_list, user):
        project_teams = list(
            ProjectTeam.objects.filter(
                team__in=item_list,
                project__status=ProjectStatus.VISIBLE,
            ).order_by('project__name', 'project__slug').select_related('project')
        )

        team_map = {i.id: i for i in item_list}
        # TODO(dcramer): we should query in bulk for ones we're missing here
        orgs = {i.organization_id: i.organization for i in item_list}

        for project_team in project_teams:
            # TODO(jess): remove when we've completely deprecated Project.team
            project_team.project._team_cache = team_map[project_team.project.team_id]
            project_team.project._organization_cache = orgs[project_team.project.organization_id]

        projects = [pt.project for pt in project_teams]
        projects_by_id = {
            project.id: data for project, data in zip(projects, serialize(projects, user))
        }

        project_map = defaultdict(list)
        for project_team in project_teams:
            project_map[project_team.team_id].append(projects_by_id[project_team.project_id])

        result = super(TeamWithProjectsSerializer, self).get_attrs(item_list, user)
        for team in item_list:
            result[team]['projects'] = project_map[team.id]
        return result

    def serialize(self, obj, attrs, user):
        d = super(TeamWithProjectsSerializer, self).serialize(obj, attrs, user)
        d['projects'] = attrs['projects']
        return d
