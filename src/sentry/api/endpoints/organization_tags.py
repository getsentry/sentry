from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.serializers import serialize
from sentry.tagstore.snuba.backend import SnubaTagStorage


class OrganizationTagsEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        try:
            filter_params = self.get_filter_params(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response([])

        # TODO(jess): update this when snuba tagstore is the primary backend for us
        tagstore = SnubaTagStorage()

        results = tagstore.get_tag_keys_for_projects(
            filter_params['project_id'],
            filter_params.get('environment'),
            filter_params['start'],
            filter_params['end'],
        )
        return Response(serialize(results, request.user))
