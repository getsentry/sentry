from __future__ import absolute_import

from rest_framework.response import Response
from django.db.models import Q

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.savedsearch import (
    DEFAULT_SAVED_SEARCH_QUERIES,
    SavedSearch,
)


class OrganizationSearchesEndpoint(OrganizationEndpoint):

    def get(self, request, organization):
        """
        List an Organization's saved searches
        `````````````````````````````````````
        Retrieve a list of saved searches for a given Organization. For custom
        saved searches, return them for all projects even if we have duplicates.
        For default searches, just return one of each search

        :auth: required

        """
        org_searches = Q(
            Q(owner=request.user) | Q(owner__isnull=True),
            ~Q(query__in=DEFAULT_SAVED_SEARCH_QUERIES),
            project__in=self.get_projects(request, organization),
        )
        global_searches = Q(is_global=True)
        saved_searches = SavedSearch.objects.filter(
            org_searches | global_searches
        ).order_by('name', 'project')

        return Response(serialize(list(saved_searches), request.user))
