from __future__ import absolute_import

import six

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry import roles
from sentry.api.serializers import serialize
from sentry.api.base import Endpoint, SessionAuthentication
from sentry.models import Organization, OrganizationMember, \
    ProjectKey, ProjectKeyStatus, Team


def get_user_admin_teams(user, orgs):
    teams = []
    for org in orgs:
        teams.extend(Team.objects.get_for_user(
            organization=org,
            user=user,
        ))
    return teams


def get_dsns(user):
    if user.is_authenticated():
        orgs = Organization.objects.filter(
            id__in=OrganizationMember.objects.filter(
                user=user,
                role__in=[r.id for r in roles.with_scope('project:read')],
            ).values('organization')
        )
        teams = set(x.id for x in get_user_admin_teams(user, orgs))
        orgs = set(x.id for x in orgs)

        queryset = ProjectKey.objects.filter(
            roles=ProjectKey.roles.store,
            project__organization__members=user,
            status=ProjectKeyStatus.ACTIVE
        ).select_related('project', 'project__team', 'project__organization')
    else:
        queryset = ProjectKey.objects.none()

    org_map = {}
    projects_by_org = {}
    keys_by_project = {}

    for key in queryset:
        if orgs is not None and key.project.organization.id not in orgs:
            continue
        if teams is not None and key.project.team.id not in teams:
            continue
        if key.project.organization_id not in org_map:
            org_map[key.project.organization_id] = key.project.organization
        projs = projects_by_org.setdefault(key.project.organization_id, {})
        if key.project_id not in projs:
            projs[key.project.id] = key.project
        keys_by_project.setdefault(key.project.id, []).append(key)

    results = []

    for org in six.itervalues(org_map):
        d = serialize(org, user)
        d['projects'] = []
        for project in six.itervalues(projects_by_org[org.id]):
            pd = serialize(project, user)
            pd['team'] = serialize(project.team, user)
            pd['dsns'] = serialize(keys_by_project.get(project.id) or [], user)
            d['projects'].append(pd)
        d['projects'].sort(key=lambda x: (x['team']['name'].lower(), x['name'].lower()))
        results.append(d)

    return results


class UserDsnsEndpoint(Endpoint):
    authentication_classes = (
        SessionAuthentication,
    )
    permission_classes = (
        IsAuthenticated,
    )

    def get(self, request):
        return Response(get_dsns(request.user))
