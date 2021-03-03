from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Group


class ShortIdLookupEndpoint(OrganizationEndpoint):
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
            group = Group.objects.by_qualified_short_id(organization.id, short_id)
        except Group.DoesNotExist:
            raise ResourceDoesNotExist()

        return Response(
            {
                "organizationSlug": organization.slug,
                "projectSlug": group.project.slug,
                "groupId": str(group.id),
                "group": serialize(group, request.user),
                "shortId": group.qualified_short_id,
            }
        )
