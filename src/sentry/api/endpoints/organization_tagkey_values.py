from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError
from sentry.api.serializers import serialize
from sentry.utils.snuba import SENTRY_SNUBA_MAP
from sentry.tagstore.base import TAG_KEY_RE
from sentry.tagstore.snuba.backend import SnubaTagStorage


class OrganizationTagKeyValuesEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization, key):
        if not TAG_KEY_RE.match(key):
            return Response({'detail': 'Invalid tag key format for "%s"' % (key,)}, status=400)

        try:
            filter_params = self.get_filter_params(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)

        # TODO(jess): update this when snuba tagstore is the primary backend for us
        tagstore = SnubaTagStorage()

        paginator = tagstore.get_tag_value_paginator_for_projects(
            filter_params['project_id'],
            filter_params.get('environment'),
            SENTRY_SNUBA_MAP.get(key, key),
            filter_params['start'],
            filter_params['end'],
            query=request.GET.get('query'),
        )
        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
        )
