from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import Group
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ResolveShortId')
def resolve_short_id_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/organizations/%s/shortids/%s/' % (
            runner.org.slug,
            group.qualified_short_id,
        )
    )


class ShortIdLookupEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    @attach_scenarios([resolve_short_id_scenario])
    def get(self, request, organization, short_id):
        """
        Resolve a Short ID
        ``````````````````

        This resolves a short ID to the project slug and internal issue ID.

        :pparam string organization_slug: the slug of the organization the
                                          short ID should be looked up in.
        :pparam string short_id: the short ID to look up.
        :auth: required
        """
        try:
            group = Group.objects.by_qualified_short_id(organization, short_id)
        except Group.DoesNotExist:
            raise ResourceDoesNotExist()

        return Response({
            'organizationSlug': organization.slug,
            'projectSlug': group.project.slug,
            'groupId': six.text_type(group.id),
            'shortId': group.qualified_short_id,
        })
