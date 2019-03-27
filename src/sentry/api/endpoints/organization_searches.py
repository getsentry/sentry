from __future__ import absolute_import

from rest_framework.response import Response
from django.db.models import Q
from django.utils import six

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.savedsearch import (
    DEFAULT_SAVED_SEARCH_QUERIES,
    SavedSearch,
)
from sentry.models.search_common import SearchType


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
        try:
            search_type = SearchType(int(request.GET.get('type', 0)))
        except ValueError as e:
            return Response(
                {'detail': 'Invalid input for `type`. Error: %s' % six.text_type(e)},
                status=400,
            )

        if request.GET.get('use_org_level') == '1':
            org_searches_q = Q(
                Q(owner=request.user) | Q(owner__isnull=True),
                organization=organization,
            )
            global_searches_q = Q(is_global=True)
            saved_searches = list(SavedSearch.objects.filter(
                org_searches_q | global_searches_q,
                type=search_type,
            ).extra(
                select={'has_owner': 'owner_id is not null', 'name__upper': 'UPPER(name)'},
                order_by=['-has_owner', 'name__upper'],
            ))
            results = []
            if saved_searches:
                pinned_search = None
                # If the saved search has an owner then it's the user's pinned
                # search. The user can only have one pinned search.
                results.append(saved_searches[0])
                if saved_searches[0].is_pinned:
                    pinned_search = saved_searches[0]
                for saved_search in saved_searches[1:]:
                    # If a search has the same query as the pinned search we
                    # want to use that search as the pinned search
                    if pinned_search and saved_search.query == pinned_search.query:
                        saved_search.is_pinned = True
                        results[0] = saved_search
                    else:
                        results.append(saved_search)
        else:
            org_searches = Q(
                Q(owner=request.user) | Q(owner__isnull=True),
                ~Q(query__in=DEFAULT_SAVED_SEARCH_QUERIES),
                project__in=self.get_projects(request, organization),
            )
            global_searches = Q(is_global=True)
            results = list(SavedSearch.objects.filter(
                org_searches | global_searches
            ).order_by('name', 'project'))

        return Response(serialize(results, request.user))
