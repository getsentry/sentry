from __future__ import absolute_import, division, print_function

from datetime import timedelta
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.app import search
from sentry.api.base import DocSection, Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.constants import (
    DEFAULT_SORT_OPTION, STATUS_CHOICES, STATUS_RESOLVED
)
from sentry.db.models.query import create_or_update
from sentry.models import (
    Activity, Group, GroupBookmark, GroupMeta, Project, TagKey
)
from sentry.search.utils import parse_query
from sentry.utils.dates import parse_date


class GroupSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=zip(
        STATUS_CHOICES.keys(), STATUS_CHOICES.keys()
    ))
    isBookmarked = serializers.BooleanField()


class ProjectGroupIndexEndpoint(Endpoint):
    doc_section = DocSection.EVENTS

    # bookmarks=0/1
    # status=<x>
    # <tag>=<value>
    def get(self, request, project_id):
        """
        Return a list of aggregates bound to this project.

        A default query of 'is:resolved' is applied. To return results with
        other statuses send an new query value (i.e. ?query= for all results).
        """
        project = Project.objects.get_from_cache(
            id=project_id,
        )

        assert_perm(project, request.user, request.auth)

        query_kwargs = {
            'project': project,
        }

        if request.GET.get('status'):
            try:
                query_kwargs['status'] = STATUS_CHOICES[request.GET['status']]
            except KeyError:
                return Response('{"error": "invalid status"}', status=400)

        if request.user.is_authenticated() and request.GET.get('bookmarks'):
            query_kwargs['bookmarked_by'] = request.user

        if request.user.is_authenticated() and request.GET.get('assigned'):
            query_kwargs['assigned_to'] = request.user

        sort_by = request.GET.get('sort')
        if sort_by is None:
            sort_by = DEFAULT_SORT_OPTION

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

        query = request.GET.get('query', 'is:unresolved')
        if query is not None:
            query_kwargs.update(parse_query(query, request.user))

        results = list(search.query(**query_kwargs))

        GroupMeta.objects.populate_cache(results)

        # TODO(dcramer): we need create a public API for 'sort_value'
        context = serialize(results, request.user)
        for group, data in zip(results, context):
            data['sortWeight'] = group.sort_value

        return Response(context)

    def put(self, request, project_id):
        """
        Bulk mutate various attributes on groups.

        - For non-status updates, only queries by 'id' are accepted.
        - For status updates, the 'id' parameter may be omitted for a batch
        "update all" query.

        PUT ?id=1&id=2&id=3
          status=resolved&
          isBookmarked=1

        Attributes:

        - status=[resolved|unresolved|muted]
        - isBookmarked=[1|0]

        If any ids are out of scope this operation will succeed without any data
        mutation
        """
        project = Project.objects.get_from_cache(
            id=project_id,
        )

        assert_perm(project, request.user, request.auth)

        group_ids = request.GET.getlist('id')
        if group_ids:
            group_list = Group.objects.filter(project=project, id__in=group_ids)
            # filter down group ids to only valid matches
            group_ids = [g.id for g in group_list]

            if not group_ids:
                return Response(status=204)

        serializer = GroupSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(status=400)

        result = serializer.object

        # validate that we've passed a selector for non-status bulk operations
        if not group_ids and result.get('isBookmarked') is not None:
            return Response(status=400)

        if group_ids:
            filters = Q(id__in=group_ids)
        else:
            filters = Q(project=project)

        if result.get('status') == 'resolved':
            now = timezone.now()

            happened = Group.objects.filter(filters).exclude(
                status=STATUS_RESOLVED,
            ).update(
                status=STATUS_RESOLVED,
                resolved_at=now,
            )

            if group_ids and happened:
                for group in group_list:
                    create_or_update(
                        Activity,
                        project=group.project,
                        group=group,
                        type=Activity.SET_RESOLVED,
                        user=request.user,
                    )
        elif result.get('status'):
            new_status = STATUS_CHOICES[result['status']]

            Group.objects.filter(filters).exclude(
                status=new_status,
            ).update(
                status=new_status,
            )

        if result.get('isBookmarked'):
            for group in group_list:
                GroupBookmark.objects.get_or_create(
                    project=group.project,
                    group=group,
                    user=request.user,
                )
        elif result.get('isBookmarked') is False:
            GroupBookmark.objects.filter(
                group__in=group_ids,
                user=request.user,
            ).delete()

        return Response(status=204)

    def delete(self, request, project_id):
        """
        Permanently remove the given groups.

        Only queries by 'id' are accepted.

        DELETE ?id=1&id=2&id=3

        If any ids are out of scope this operation will succeed without any data
        mutation
        """
        project = Project.objects.get_from_cache(
            id=project_id,
        )

        assert_perm(project, request.user, request.auth)

        group_ids = request.GET.getlist('id')
        if group_ids:
            group_list = Group.objects.filter(project=project, id__in=group_ids)
            # filter down group ids to only valid matches
            group_ids = [g.id for g in group_list]
        else:
            # missing any kind of filter
            return Response(status=400)

        if not group_ids:
            return Response(status=204)

        group_list.delete()

        return Response(status=204)
