from __future__ import absolute_import

from django.utils import six
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.recentsearch import RecentSearch
from sentry.models.search_common import SearchType


class OrganizationRecentSearchesEndpoint(OrganizationEndpoint):

    def get(self, request, organization):
        """
        List recent searches for a User within an Organization
        ``````````````````````````````````````````````````````
        Returns recent searches for a user in a given Organization.

        :auth: required

        """
        try:
            search_type = SearchType(int(request.GET.get('type', 0)))
        except ValueError as e:
            return Response(
                {'detail': 'Invalid input for `type`. Error: %s' % six.text_type(e)},
                status=400,
            )

        try:
            limit = int(request.GET.get('limit', 3))
        except ValueError as e:
            return Response(
                {'detail': 'Invalid input for `limit`. Error: %s' % six.text_type(e)},
                status=400,
            )

        recent_searches = list(RecentSearch.objects.filter(
            organization=organization,
            user=request.user,
            type=search_type,
        ).order_by('-last_seen')[:limit])

        return Response(serialize(recent_searches, request.user))
