from __future__ import absolute_import

from functools import partial

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsV2EndpointBase, OrganizationEventsError, NoProjects
from sentry.api.paginator import GenericOffsetPaginator
from sentry.utils.snuba import transform_aliases_and_query


class OrganizationEventsV2Endpoint(OrganizationEventsV2EndpointBase):

    def get(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            # return empty result if org doesn't have projects
            # or user doesn't have access to projects in org
            data_fn = lambda *args, **kwargs: []
        else:
            data_fn = partial(
                lambda *args, **kwargs: transform_aliases_and_query(*args, **kwargs)['data'],
                referrer='api.organization-events-v2',
                **snuba_args
            )

            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn)
            )
