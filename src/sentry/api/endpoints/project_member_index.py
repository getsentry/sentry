from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import OrganizationMember, User


class ProjectMemberIndexEndpoint(ProjectEndpoint):
    def get(self, request, project):
        member_list = sorted(set(User.objects.filter(
            is_active=True,
            sentry_orgmember_set__organization=project.organization,
            sentry_orgmember_set__id__in=OrganizationMember.objects.filter(
                organizationmemberteam__is_active=True,
                organizationmemberteam__team=project.team,
            ).values('id')
        ).distinct()[:1000]), key=lambda x: x.email)

        member_list = serialize(member_list, request.user)

        return Response(member_list)
