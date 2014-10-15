from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from rest_framework.response import Response

from sentry.app import search
from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.constants import DEFAULT_SORT_OPTION
from sentry.models import TagKey, Project
from sentry.utils.dates import parse_date


class ProjectGroupIndexEndpoint(Endpoint):
    # bookmarks=0/1
    # status=<x>
    # <tag>=<value>
    def get(self, request, project_id):
        project = Project.objects.get(
            id=project_id,
        )

        assert_perm(project, request.user, request.auth)

        query_kwargs = {
            'project': project,
        }

        if request.GET.get('status'):
            query_kwargs['status'] = int(request.GET['status'])

        if request.user.is_authenticated() and request.GET.get('bookmarks'):
            query_kwargs['bookmarked_by'] = request.user

        sort_by = request.GET.get('sort') or request.session.get('streamsort')
        if sort_by is None:
            sort_by = DEFAULT_SORT_OPTION

        # Save last sort in session
        if sort_by != request.session.get('streamsort'):
            request.session['streamsort'] = sort_by

        query_kwargs['sort_by'] = sort_by

        tags = {}
        for tag_key in TagKey.objects.all_keys(project):
            if request.GET.get(tag_key):
                tags[tag_key] = request.GET[tag_key]
        if tags:
            query_kwargs['tags'] = tags

        # TODO: dates should include timestamps
        date_from = request.GET.get('since')
        time_from = request.GET.get('until')
        date_filter = request.GET.get('date_filter')

        date_to = request.GET.get('dt')
        time_to = request.GET.get('tt')

        today = timezone.now()
        # date format is Y-m-d
        if any(x is not None for x in [date_from, time_from, date_to, time_to]):
            date_from, date_to = parse_date(date_from, time_from), parse_date(date_to, time_to)
        else:
            date_from = today - timedelta(days=5)
            date_to = None

        query_kwargs['date_from'] = date_from
        query_kwargs['date_to'] = date_to
        if date_filter:
            query_kwargs['date_filter'] = date_filter

        # TODO: proper pagination support
        cursor = request.GET.get('cursor')
        if cursor:
            query_kwargs['cursor'] = cursor

        results = search.query(**query_kwargs)

        return Response(serialize(list(results), request.user))
