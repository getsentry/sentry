from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.helpers.releases import get_group_ids_resolved_in_release
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializerSnuba
from sentry.models import Group


class OrganizationIssuesResolvedInReleaseEndpoint(OrganizationEndpoint, EnvironmentMixin):
    permission_classes = (OrganizationPermission,)

    def get(self, request, organization, version):
        """
        List issues to be resolved in a particular release
        ``````````````````````````````````````````````````

        Retrieve a list of issues to be resolved in a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        group_ids = get_group_ids_resolved_in_release(organization, version)
        groups = Group.objects.filter(
            project__in=self.get_projects(request, organization), id__in=group_ids
        )

        context = serialize(
            list(groups),
            request.user,
            GroupSerializerSnuba(
                environment_ids=[e.id for e in self.get_environments(request, organization)]
            ),
        )
        return Response(context)
