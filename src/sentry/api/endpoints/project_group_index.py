from __future__ import absolute_import, division, print_function

from datetime import datetime
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.app import search
from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.constants import (
    DEFAULT_SORT_OPTION, STATUS_CHOICES, STATUS_UNRESOLVED
)
from sentry.db.models.query import create_or_update
from sentry.models import (
    Activity, EventMapping, Group, GroupBookmark, GroupSeen, GroupStatus, TagKey
)
from sentry.search.utils import parse_query
from sentry.tasks.deletion import delete_group
from sentry.tasks.merge import merge_group
from sentry.utils.cursors import Cursor

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


class GroupSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=zip(
        STATUS_CHOICES.keys(), STATUS_CHOICES.keys()
    ))
    hasSeen = serializers.BooleanField()
    isBookmarked = serializers.BooleanField()
    isPublic = serializers.BooleanField()
    merge = serializers.BooleanField()


class ProjectGroupIndexEndpoint(ProjectEndpoint):
    doc_section = DocSection.EVENTS

    permission_classes = (ProjectEventPermission,)

    def _parse_date(self, value):
        try:
            return datetime.utcfromtimestamp(float(value)).replace(
                tzinfo=timezone.utc,
            )
        except ValueError:
            return datetime.strptime(value, '%Y-%m-%dT%H:%M:%S.%fZ').replace(
                tzinfo=timezone.utc,
            )

    # bookmarks=0/1
    # status=<x>
    # <tag>=<value>
    # statsPeriod=24h
    def get(self, request, project):
        """
        List a project's aggregates

        Return a list of aggregates bound to a project.

            {method} {path}

        A default query of 'is:resolved' is applied. To return results with
        other statuses send an new query value (i.e. ?query= for all results).

        Any standard Sentry structured search query can be passed via the
        ``query`` parameter.

        The ``statsPeriod`` parameter can be used to select the timeline stats
        which should be present. Possible values are: '' (disable), '24h', '14d'
        """
        query_kwargs = {
            'project': project,
        }

        stats_period = request.GET.get('statsPeriod')
        if stats_period not in (None, '', '24h', '14d'):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        elif stats_period is None:
            # default
            stats_period = '24h'
        elif stats_period == '':
            # disable stats
            stats_period = None

        if request.GET.get('status'):
            try:
                query_kwargs['status'] = STATUS_CHOICES[request.GET['status']]
            except KeyError:
                return Response('{"detail": "invalid status"}', status=400)

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
        date_to = request.GET.get('until')
        date_filter = request.GET.get('date_filter')

        limit = request.GET.get('limit')
        if limit:
            try:
                query_kwargs['limit'] = int(limit)
            except ValueError:
                return Response('{"detail": "invalid limit"}', status=400)

        if date_from:
            date_from = self._parse_date(date_from)

        if date_to:
            date_to = self._parse_date(date_to)

        query_kwargs['date_from'] = date_from
        query_kwargs['date_to'] = date_to
        if date_filter:
            query_kwargs['date_filter'] = date_filter

        # TODO: proper pagination support
        cursor = request.GET.get('cursor')
        if cursor:
            query_kwargs['cursor'] = Cursor.from_string(cursor)

        query = request.GET.get('query', 'is:unresolved').strip()
        if len(query) == 32:
            # check to see if we've got an event ID
            try:
                matching_event = EventMapping.objects.filter(
                    project=project,
                    event_id=query,
                ).select_related('group')[0]
            except IndexError:
                pass
            else:
                return Response(serialize(
                    [matching_event.group], request.user, StreamGroupSerializer(
                        stats_period=stats_period
                    )
                ))

        if query is not None:
            query_kwargs.update(parse_query(query, request.user))

        cursor_result = search.query(**query_kwargs)

        results = list(cursor_result)

        # HACK: remove auto resolved entries
        if query_kwargs.get('status') == STATUS_UNRESOLVED:
            results = [
                r for r in results
                if not r.is_resolved()
            ]

        response = Response(serialize(
            results, request.user, StreamGroupSerializer(
                stats_period=stats_period
            )
        ))
        response['Link'] = ', '.join([
            self.build_cursor_link(request, 'previous', cursor_result.prev),
            self.build_cursor_link(request, 'next', cursor_result.next),
        ])

        return response

    def put(self, request, project):
        """
        Bulk mutate a list of aggregates

        Bulk mutate various attributes on aggregates.

            {method} {path}?id=1&id=2&id=3
            {{
              "status": "resolved",
              "isBookmarked": true
            }}

        - For non-status updates, the 'id' parameter is required.
        - For status updates, the 'id' parameter may be omitted for a batch
          "update all" query.
        - An optional 'status' parameter may be used to restrict mutations to
          only events with the given status.

        For example, to resolve all aggregates (project-wide):

            {method} {path}
            {{
                "status": "resolved"
            }}

        Attributes:

        - status: resolved, unresolved, muted
        - hasSeen: true, false
        - isBookmarked: true, false
        - isPublic: true, false
        - merge: true, false

        If any ids are out of scope this operation will succeed without any data
        mutation.
        """
        group_ids = request.GET.getlist('id')
        if group_ids:
            group_list = Group.objects.filter(project=project, id__in=group_ids)
            # filter down group ids to only valid matches
            group_ids = [g.id for g in group_list]

            if not group_ids:
                return Response(status=204)
        else:
            group_list = None

        serializer = GroupSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = dict(serializer.object)

        # validate that we've passed a selector for non-status bulk operations
        if not group_ids and result.keys() != ['status']:
            return Response('{"detail": "You must specify a list of IDs for this operation"}', status=400)

        if group_ids:
            filters = [Q(id__in=group_ids)]
        else:
            filters = [Q(project=project)]

        if request.GET.get('status'):
            try:
                status_filter = STATUS_CHOICES[request.GET['status']]
            except KeyError:
                return Response('{"detail": "Invalid status"}', status=400)
            filters.append(Q(status=status_filter))

        if result.get('status') == 'resolved':
            now = timezone.now()

            happened = Group.objects.filter(*filters).exclude(
                status=GroupStatus.RESOLVED,
            ).update(
                status=GroupStatus.RESOLVED,
                resolved_at=now,
            )

            if group_list and happened:
                for group in group_list:
                    group.status = GroupStatus.RESOLVED
                    group.resolved_at = now
                    activity = Activity.objects.create(
                        project=group.project,
                        group=group,
                        type=Activity.SET_RESOLVED,
                        user=request.user,
                    )
                    activity.send_notification()

        elif result.get('status'):
            new_status = STATUS_CHOICES[result['status']]

            happened = Group.objects.filter(*filters).exclude(
                status=new_status,
            ).update(
                status=new_status,
            )
            if group_list and happened:
                if new_status == GroupStatus.UNRESOLVED:
                    activity_type = Activity.SET_UNRESOLVED
                elif new_status == GroupStatus.MUTED:
                    activity_type = Activity.SET_MUTED

                for group in group_list:
                    group.status = new_status
                    activity = Activity.objects.create(
                        project=group.project,
                        group=group,
                        type=activity_type,
                        user=request.user,
                    )
                    activity.send_notification()

        if result.get('hasSeen') and project.member_set.filter(user=request.user).exists():
            for group in group_list:
                instance, created = create_or_update(
                    GroupSeen,
                    group=group,
                    user=request.user,
                    project=group.project,
                    values={
                        'last_seen': timezone.now(),
                    }
                )
        elif result.get('hasSeen') is False:
            GroupSeen.objects.filter(
                group__in=group_ids,
                user=request.user,
            ).delete()

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

        if result.get('isPublic'):
            Group.objects.filter(
                id__in=group_ids,
            ).update(is_public=True)
            for group in group_list:
                if group.is_public:
                    continue
                group.is_public = True
                Activity.objects.create(
                    project=group.project,
                    group=group,
                    type=Activity.SET_PUBLIC,
                    user=request.user,
                )
        elif result.get('isPublic') is False:
            Group.objects.filter(
                id__in=group_ids,
            ).update(is_public=False)
            for group in group_list:
                if not group.is_public:
                    continue
                group.is_public = False
                Activity.objects.create(
                    project=group.project,
                    group=group,
                    type=Activity.SET_PRIVATE,
                    user=request.user,
                )

        # XXX(dcramer): this feels a bit shady like it should be its own
        # endpoint
        if result.get('merge') and len(group_list) > 1:
            primary_group = sorted(group_list, key=lambda x: -x.times_seen)[0]
            children = []
            for group in group_list:
                if group == primary_group:
                    continue
                children.append(group)
                group.update(status=GroupStatus.PENDING_MERGE)
                merge_group.delay(
                    from_object_id=group.id,
                    to_object_id=primary_group.id,
                )
            result['merge'] = {
                'parent': str(primary_group.id),
                'children': [str(g.id) for g in children],
            }

        return Response(result)

    def delete(self, request, project):
        """
        Bulk remove a list of aggregates

        Permanently remove the given aggregates.

        Only queries by 'id' are accepted.

            {method} {path}?id=1&id=2&id=3

        If any ids are out of scope this operation will succeed without any data
        mutation
        """
        group_ids = request.GET.getlist('id')
        if group_ids:
            group_list = Group.objects.filter(project=project, id__in=group_ids)
            # filter down group ids to only valid matches
            group_ids = [g.id for g in group_list]
        else:
            # missing any kind of filter
            return Response('{"detail": "You must specify a list of IDs for this operation"}', status=400)

        if not group_ids:
            return Response(status=204)

        # TODO(dcramer): set status to pending deletion
        for group in group_list:
            delete_group.delay(object_id=group.id)

        return Response(status=204)
