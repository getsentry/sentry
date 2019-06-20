from __future__ import absolute_import

import logging
import six

from rest_framework.response import Response

from sentry import tagstore
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.serializers import serialize
from sentry.tagstore.snuba.utils import lookup_tags
from sentry.utils.snuba import SnubaError
from sentry import features

logger = logging.getLogger('sentry.api.organization-events-heatmap')


class OrganizationEventsHeatmapEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response({'detail': 'A valid project must be included.'}, status=400)

        try:
            keys = self._validate_keys(request)
            self._validate_project_ids(request, organization, snuba_args)
        except OrganizationEventsError as error:
            return Response({'detail': six.text_type(error)}, status=400)

        try:
            tags = lookup_tags(keys, **snuba_args)
        except (KeyError, SnubaError) as error:
            logger.info(
                'api.organization-events-heatmap',
                extra={
                    'organization_id': organization.id,
                    'user_id': request.user.id,
                    'keys': keys,
                    'snuba_args': snuba_args,
                    'error': six.text_type(error)
                }
            )
            return Response({
                'detail': 'Invalid query.'
            }, status=400)

        return Response(serialize(tags, request.user))

    def _validate_keys(self, request):
        keys = request.GET.getlist('key')
        if not keys:
            raise OrganizationEventsError('Tag keys must be specified.')

        for key in keys:
            if not tagstore.is_valid_key(key):
                raise OrganizationEventsError('Tag key %s is not valid.' % key)

        return keys

    def _validate_project_ids(self, request, organization, snuba_args):
        project_ids = snuba_args['filter_keys']['project_id']

        has_global_views = features.has(
            'organizations:global-views',
            organization,
            actor=request.user)

        if not has_global_views and len(project_ids) > 1:
            raise OrganizationEventsError('You cannot view events from multiple projects.')

        return project_ids
