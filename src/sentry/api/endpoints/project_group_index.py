from __future__ import absolute_import, division, print_function

import six

from datetime import timedelta
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.app import search
from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.constants import DEFAULT_SORT_OPTION
from sentry.db.models.query import create_or_update
from sentry.models import (
    Activity, EventMapping, Group, GroupBookmark, GroupResolution, GroupSeen,
    GroupSubscription, GroupSubscriptionReason, GroupSnooze, GroupStatus,
    Release, TagKey
)
from sentry.models.group import looks_like_short_id
from sentry.search.utils import parse_query
from sentry.tasks.deletion import delete_group
from sentry.tasks.merge import merge_group
from sentry.utils.cursors import Cursor
from sentry.utils.apidocs import scenario, attach_scenarios

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


@scenario('BulkUpdateAggregates')
def bulk_update_aggregates_scenario(runner):
    project = runner.default_project
    group1, group2 = Group.objects.filter(project=project)[:2]
    runner.request(
        method='PUT',
        path='/projects/%s/%s/issues/?id=%s&id=%s' % (
            runner.org.slug, project.slug, group1.id, group2.id),
        data={'status': 'unresolved', 'isPublic': False}
    )


@scenario('BulkRemoveAggregates')
def bulk_remove_aggregates_scenario(runner):
    with runner.isolated_project('Amazing Plumbing') as project:
        group1, group2 = Group.objects.filter(project=project)[:2]
        runner.request(
            method='DELETE',
            path='/projects/%s/%s/issues/?id=%s&id=%s' % (
                runner.org.slug, project.slug, group1.id, group2.id),
        )


@scenario('ListProjectAggregates')
def list_project_aggregates_scenario(runner):
    project = runner.default_project
    runner.request(
        method='GET',
        path='/projects/%s/%s/issues/?statsPeriod=24h' % (
            runner.org.slug, project.slug),
    )


STATUS_CHOICES = {
    'resolved': GroupStatus.RESOLVED,
    'unresolved': GroupStatus.UNRESOLVED,
    'muted': GroupStatus.MUTED,
    'resolvedInNextRelease': GroupStatus.UNRESOLVED,
}


class ValidationError(Exception):
    pass


class GroupSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=zip(
        STATUS_CHOICES.keys(), STATUS_CHOICES.keys()
    ))
    hasSeen = serializers.BooleanField()
    isBookmarked = serializers.BooleanField()
    isPublic = serializers.BooleanField()
    isSubscribed = serializers.BooleanField()
    merge = serializers.BooleanField()
    snoozeDuration = serializers.IntegerField()


class ProjectGroupIndexEndpoint(ProjectEndpoint):
    doc_section = DocSection.EVENTS

    permission_classes = (ProjectEventPermission,)

    def _build_query_params_from_request(self, request, project):
        query_kwargs = {
            'project': project,
        }

        if request.GET.get('status'):
            try:
                query_kwargs['status'] = STATUS_CHOICES[request.GET['status']]
            except KeyError:
                raise ValidationError('invalid status')

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

        limit = request.GET.get('limit')
        if limit:
            try:
                query_kwargs['limit'] = int(limit)
            except ValueError:
                raise ValidationError('invalid limit')

        # TODO: proper pagination support
        cursor = request.GET.get('cursor')
        if cursor:
            query_kwargs['cursor'] = Cursor.from_string(cursor)

        query = request.GET.get('query', 'is:unresolved').strip()
        if query:
            query_kwargs.update(parse_query(project, query, request.user))

        return query_kwargs

    # bookmarks=0/1
    # status=<x>
    # <tag>=<value>
    # statsPeriod=24h
    @attach_scenarios([list_project_aggregates_scenario])
    def get(self, request, project):
        """
        List a Project's Aggregates
        ```````````````````````````

        Return a list of aggregates bound to a project.  All parameters are
        supplied as query string parameters.

        A default query of ``is:resolved`` is applied. To return results
        with other statuses send an new query value (i.e. ``?query=`` for all
        results).

        The ``statsPeriod`` parameter can be used to select the timeline
        stats which should be present. Possible values are: '' (disable),
        '24h', '14d'

        :qparam string statsPeriod: an optional stat period (can be one of
                                    ``"24h"``, ``"14d"``, and ``""``).
        :qparam bool shortIdLookup: if this is set to true then short IDs are
                                    looked up by this function as well.  This
                                    can cause the return value of the function
                                    to return an event group of a different
                                    project which is why this is an opt-in.
                                    Set to `1` to enable.
        :qparam querystring query: an optional Sentry structured search
                                   query.  If not provided an implied
                                   ``"is:resolved"`` is assumed.)
        :pparam string organization_slug: the slug of the organization the
                                          groups belong to.
        :pparam string project_slug: the slug of the project the groups
                                     belong to.
        :auth: required
        """
        stats_period = request.GET.get('statsPeriod')
        if stats_period not in (None, '', '24h', '14d'):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        elif stats_period is None:
            # default
            stats_period = '24h'
        elif stats_period == '':
            # disable stats
            stats_period = None

        query = request.GET.get('query', '').strip()
        if query:
            matching_group = None
            if len(query) == 32:
                # check to see if we've got an event ID
                try:
                    mapping = EventMapping.objects.get(
                        project_id=project.id,
                        event_id=query,
                    )
                except EventMapping.DoesNotExist:
                    pass
                else:
                    matching_group = Group.objects.get(id=mapping.group_id)

            # If the query looks like a short id, we want to provide some
            # information about where that is.  Note that this can return
            # results for another project.  The UI deals with this.
            elif request.GET.get('shortIdLookup') == '1' and \
                    looks_like_short_id(query):
                try:
                    matching_group = Group.objects.by_qualified_short_id(
                        project.organization, query)
                except Group.DoesNotExist:
                    matching_group = None

            if matching_group is not None:
                response = Response(serialize(
                    [matching_group], request.user, StreamGroupSerializer(
                        stats_period=stats_period
                    )
                ))
                response['X-Sentry-Direct-Hit'] = '1'
                return response

        try:
            query_kwargs = self._build_query_params_from_request(request, project)
        except ValidationError as exc:
            return Response({'detail': six.text_type(exc)}, status=400)

        cursor_result = search.query(**query_kwargs)

        results = list(cursor_result)

        context = serialize(
            results, request.user, StreamGroupSerializer(
                stats_period=stats_period
            )
        )

        # HACK: remove auto resolved entries
        if query_kwargs.get('status') == GroupStatus.UNRESOLVED:
            context = [
                r for r in context
                if r['status'] == 'unresolved'
            ]

        response = Response(context)
        response['Link'] = ', '.join([
            self.build_cursor_link(request, 'previous', cursor_result.prev),
            self.build_cursor_link(request, 'next', cursor_result.next),
        ])

        return response

    @attach_scenarios([bulk_update_aggregates_scenario])
    def put(self, request, project):
        """
        Bulk Mutate a List of Aggregates
        ````````````````````````````````

        Bulk mutate various attributes on aggregates.  The list of groups
        to modify is given through the `id` query parameter.  It is repeated
        for each group that should be modified.

        - For non-status updates, the `id` query parameter is required.
        - For status updates, the `id` query parameter may be omitted
          for a batch "update all" query.
        - An optional `status` query parameter may be used to restrict
          mutations to only events with the given status.

        The following attributes can be modified and are supplied as
        JSON object in the body:

        If any ids are out of scope this operation will succeed without
        any data mutation.

        :qparam int id: a list of IDs of the groups to be mutated.  This
                        parameter shall be repeated for each group.  It
                        is optional only if a status is mutated in which
                        case an implicit `update all` is assumed.
        :qparam string status: optionally limits the query to groups of the
                               specified status.  Valid values are
                               ``"resolved"``, ``"unresolved"`` and
                               ``"muted"``.
        :pparam string organization_slug: the slug of the organization the
                                          groups belong to.
        :pparam string project_slug: the slug of the project the groups
                                     belong to.
        :param string status: the new status for the groups.  Valid values
                              are ``"resolved"``, ``"unresolved"`` and
                              ``"muted"``.
        :param int snoozeDuration: the number of minutes to mute this issue.
        :param boolean isPublic: sets the group to public or private.
        :param boolean merge: allows to merge or unmerge different groups.
        :param boolean hasSeen: in case this API call is invoked with a user
                                context this allows changing of the flag
                                that indicates if the user has seen the
                                event.
        :param boolean isBookmarked: in case this API call is invoked with a
                                     user context this allows changing of
                                     the bookmark flag.
        :auth: required
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

        acting_user = request.user if request.user.is_authenticated() else None

        if not group_ids:
            try:
                query_kwargs = self._build_query_params_from_request(request, project)
            except ValidationError as exc:
                return Response({'detail': six.text_type(exc)}, status=400)

            # bulk mutations are limited to 1000 items
            # TODO(dcramer): it'd be nice to support more than this, but its
            # a bit too complicated right now
            query_kwargs['limit'] = 1000

            cursor_result = search.query(**query_kwargs)

            group_list = list(cursor_result)
            group_ids = [g.id for g in group_list]

        is_bulk = len(group_ids) > 1

        queryset = Group.objects.filter(
            id__in=group_ids,
        )

        if result.get('status') == 'resolvedInNextRelease':
            try:
                release = Release.objects.filter(
                    project=project,
                ).order_by('-date_added')[0]
            except IndexError:
                return Response('{"detail": "No release data present in the system to indicate form a basis for \'Next Release\'"}', status=400)

            now = timezone.now()

            for group in group_list:
                try:
                    with transaction.atomic():
                        resolution, created = GroupResolution.objects.create(
                            group=group,
                            release=release,
                        ), True
                except IntegrityError:
                    resolution, created = GroupResolution.objects.get(
                        group=group,
                    ), False

                if acting_user:
                    GroupSubscription.objects.subscribe(
                        user=acting_user,
                        group=group,
                        reason=GroupSubscriptionReason.status_change,
                    )

                if created:
                    activity = Activity.objects.create(
                        project=group.project,
                        group=group,
                        type=Activity.SET_RESOLVED_IN_RELEASE,
                        user=acting_user,
                        ident=resolution.id,
                        data={
                            # no version yet
                            'version': '',
                        }
                    )
                    # TODO(dcramer): we need a solution for activity rollups
                    # before sending notifications on bulk changes
                    if not is_bulk:
                        activity.send_notification()

            queryset.update(
                status=GroupStatus.RESOLVED,
                resolved_at=now,
            )

            result.update({
                'status': 'resolved',
                'statusDetails': {
                    'inNextRelease': True,
                },
            })

        elif result.get('status') == 'resolved':
            now = timezone.now()

            happened = queryset.exclude(
                status=GroupStatus.RESOLVED,
            ).update(
                status=GroupStatus.RESOLVED,
                resolved_at=now,
            )

            GroupResolution.objects.filter(
                group__in=group_ids,
            ).delete()

            if group_list and happened:
                for group in group_list:
                    group.status = GroupStatus.RESOLVED
                    group.resolved_at = now
                    if acting_user:
                        GroupSubscription.objects.subscribe(
                            user=acting_user,
                            group=group,
                            reason=GroupSubscriptionReason.status_change,
                        )
                    activity = Activity.objects.create(
                        project=group.project,
                        group=group,
                        type=Activity.SET_RESOLVED,
                        user=acting_user,
                    )
                    # TODO(dcramer): we need a solution for activity rollups
                    # before sending notifications on bulk changes
                    if not is_bulk:
                        activity.send_notification()

            result['statusDetails'] = {}

        elif result.get('status'):
            new_status = STATUS_CHOICES[result['status']]

            happened = queryset.exclude(
                status=new_status,
            ).update(
                status=new_status,
            )

            GroupResolution.objects.filter(
                group__in=group_ids,
            ).delete()

            if new_status == GroupStatus.MUTED:
                snooze_duration = result.pop('snoozeDuration', None)
                if snooze_duration:
                    snooze_until = timezone.now() + timedelta(
                        minutes=snooze_duration,
                    )
                    for group in group_list:
                        GroupSnooze.objects.create_or_update(
                            group=group,
                            values={
                                'until': snooze_until,
                            }
                        )
                        result['statusDetails'] = {
                            'snoozeUntil': snooze_until,
                        }
                else:
                    GroupSnooze.objects.filter(
                        group__in=group_ids,
                    ).delete()
                    snooze_until = None
                    result['statusDetails'] = {}
            else:
                result['statusDetails'] = {}

            if group_list and happened:
                if new_status == GroupStatus.UNRESOLVED:
                    activity_type = Activity.SET_UNRESOLVED
                    activity_data = {}
                elif new_status == GroupStatus.MUTED:
                    activity_type = Activity.SET_MUTED
                    activity_data = {
                        'snoozeUntil': snooze_until,
                        'snoozeDuration': snooze_duration,
                    }

                for group in group_list:
                    group.status = new_status

                    activity = Activity.objects.create(
                        project=group.project,
                        group=group,
                        type=activity_type,
                        user=acting_user,
                        data=activity_data,
                    )
                    # TODO(dcramer): we need a solution for activity rollups
                    # before sending notifications on bulk changes
                    if not is_bulk:
                        if acting_user:
                            GroupSubscription.objects.subscribe(
                                user=acting_user,
                                group=group,
                                reason=GroupSubscriptionReason.status_change,
                            )
                        activity.send_notification()

        if result.get('hasSeen') and project.member_set.filter(user=acting_user).exists():
            for group in group_list:
                instance, created = create_or_update(
                    GroupSeen,
                    group=group,
                    user=acting_user,
                    project=group.project,
                    values={
                        'last_seen': timezone.now(),
                    }
                )
        elif result.get('hasSeen') is False:
            GroupSeen.objects.filter(
                group__in=group_ids,
                user=acting_user,
            ).delete()

        if result.get('isBookmarked'):
            for group in group_list:
                GroupBookmark.objects.get_or_create(
                    project=project,
                    group=group,
                    user=acting_user,
                )
                GroupSubscription.objects.subscribe(
                    user=acting_user,
                    group=group,
                    reason=GroupSubscriptionReason.bookmark,
                )
        elif result.get('isBookmarked') is False:
            GroupBookmark.objects.filter(
                group__in=group_ids,
                user=acting_user,
            ).delete()

        # TODO(dcramer): we could make these more efficient by first
        # querying for rich rows are present (if N > 2), flipping the flag
        # on those rows, and then creating the missing rows
        if result.get('isSubscribed') in (True, False):
            is_subscribed = result['isSubscribed']
            for group in group_list:
                GroupSubscription.objects.create_or_update(
                    user=acting_user,
                    group=group,
                    project=project,
                    values={'is_active': is_subscribed},
                )

        if result.get('isPublic'):
            queryset.update(is_public=True)
            for group in group_list:
                if group.is_public:
                    continue
                group.is_public = True
                Activity.objects.create(
                    project=group.project,
                    group=group,
                    type=Activity.SET_PUBLIC,
                    user=acting_user,
                )
        elif result.get('isPublic') is False:
            queryset.update(is_public=False)
            for group in group_list:
                if not group.is_public:
                    continue
                group.is_public = False
                Activity.objects.create(
                    project=group.project,
                    group=group,
                    type=Activity.SET_PRIVATE,
                    user=acting_user,
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

            Activity.objects.create(
                project=primary_group.project,
                group=primary_group,
                type=Activity.MERGE,
                user=acting_user,
                data={
                    'issues': [{'id': c.id} for c in children],
                },
            )

            result['merge'] = {
                'parent': six.text_type(primary_group.id),
                'children': [six.text_type(g.id) for g in children],
            }

        return Response(result)

    @attach_scenarios([bulk_remove_aggregates_scenario])
    def delete(self, request, project):
        """
        Bulk Remove a List of Aggregates
        ````````````````````````````````

        Permanently remove the given aggregates. The list of groups to
        modify is given through the `id` query parameter.  It is repeated
        for each group that should be removed.

        Only queries by 'id' are accepted.

        If any ids are out of scope this operation will succeed without
        any data mutation.

        :qparam int id: a list of IDs of the groups to be removed.  This
                        parameter shall be repeated for each group.
        :pparam string organization_slug: the slug of the organization the
                                          groups belong to.
        :pparam string project_slug: the slug of the project the groups
                                     belong to.
        :auth: required
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
            delete_group.delay(object_id=group.id, countdown=3600)

        return Response(status=204)
