from __future__ import absolute_import, division, print_function

from datetime import timedelta
import functools
import logging
from uuid import uuid4

import six
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry import analytics, eventstream, features, search
from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.fields import ActorField, Actor
from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.api.serializers.models.group import (
    SUBSCRIPTION_REASON_MAP, StreamGroupSerializer)
from sentry.constants import DEFAULT_SORT_OPTION
from sentry.db.models.query import create_or_update
from sentry.models import (
    Activity, Environment, Group, GroupAssignee, GroupBookmark, GroupHash, GroupResolution,
    GroupSeen, GroupShare, GroupSnooze, GroupStatus, GroupSubscription, GroupSubscriptionReason,
    GroupHashTombstone, GroupTombstone, Release, TOMBSTONE_FIELDS_FROM_GROUP, UserOption, User, Team
)
from sentry.models.event import Event
from sentry.models.group import looks_like_short_id
from sentry.receivers import DEFAULT_SAVED_SEARCHES
from sentry.search.utils import InvalidQuery, parse_query
from sentry.signals import advanced_search, issue_ignored, issue_resolved_in_release, issue_deleted
from sentry.tasks.deletion import delete_group
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.tasks.merge import merge_group
from sentry.utils.apidocs import attach_scenarios, scenario
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.functional import extract_lazy_object

delete_logger = logging.getLogger('sentry.deletions.api')

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"
SAVED_SEARCH_QUERIES = set([s['query'] for s in DEFAULT_SAVED_SEARCHES])


@scenario('BulkUpdateIssues')
def bulk_update_issues_scenario(runner):
    project = runner.default_project
    group1, group2 = Group.objects.filter(project=project)[:2]
    runner.request(
        method='PUT',
        path='/projects/%s/%s/issues/?id=%s&id=%s' %
        (runner.org.slug, project.slug, group1.id, group2.id),
        data={'status': 'unresolved',
              'isPublic': False}
    )


@scenario('BulkRemoveIssuess')
def bulk_remove_issues_scenario(runner):
    with runner.isolated_project('Amazing Plumbing') as project:
        group1, group2 = Group.objects.filter(project=project)[:2]
        runner.request(
            method='DELETE',
            path='/projects/%s/%s/issues/?id=%s&id=%s' %
            (runner.org.slug, project.slug, group1.id, group2.id),
        )


@scenario('ListProjectIssuess')
def list_project_issues_scenario(runner):
    project = runner.default_project
    runner.request(
        method='GET',
        path='/projects/%s/%s/issues/?statsPeriod=24h' % (
            runner.org.slug, project.slug),
    )


STATUS_CHOICES = {
    'resolved': GroupStatus.RESOLVED,
    'unresolved': GroupStatus.UNRESOLVED,
    'ignored': GroupStatus.IGNORED,
    'resolvedInNextRelease': GroupStatus.UNRESOLVED,

    # TODO(dcramer): remove in 9.0
    'muted': GroupStatus.IGNORED,
}


class ValidationError(Exception):
    pass


class StatusDetailsValidator(serializers.Serializer):
    inNextRelease = serializers.BooleanField()
    inRelease = serializers.CharField()
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)

    def validate_inRelease(self, attrs, source):
        value = attrs[source]
        project = self.context['project']
        if value == 'latest':
            try:
                attrs[source] = Release.objects.filter(
                    projects=project,
                    organization_id=project.organization_id,
                ).extra(select={
                    'sort': 'COALESCE(date_released, date_added)',
                }).order_by('-sort')[0]
            except IndexError:
                raise serializers.ValidationError(
                    'No release data present in the system to form a basis for \'Next Release\''
                )
        else:
            try:
                attrs[source] = Release.objects.get(
                    projects=project,
                    organization_id=project.organization_id,
                    version=value,
                )
            except Release.DoesNotExist:
                raise serializers.ValidationError(
                    'Unable to find a release with the given version.'
                )
        return attrs

    def validate_inNextRelease(self, attrs, source):
        project = self.context['project']
        if not Release.objects.filter(
            projects=project,
            organization_id=project.organization_id,
        ).exists():
            raise serializers.ValidationError(
                'No release data present in the system to form a basis for \'Next Release\''
            )
        return attrs


class GroupValidator(serializers.Serializer):
    status = serializers.ChoiceField(choices=zip(
        STATUS_CHOICES.keys(), STATUS_CHOICES.keys()))
    statusDetails = StatusDetailsValidator()
    hasSeen = serializers.BooleanField()
    isBookmarked = serializers.BooleanField()
    isPublic = serializers.BooleanField()
    isSubscribed = serializers.BooleanField()
    merge = serializers.BooleanField()
    discard = serializers.BooleanField()
    ignoreDuration = serializers.IntegerField()
    ignoreCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    ignoreUserCount = serializers.IntegerField()
    # in minutes, max of one week
    ignoreUserWindow = serializers.IntegerField(max_value=7 * 24 * 60)
    assignedTo = ActorField()

    # TODO(dcramer): remove in 9.0
    snoozeDuration = serializers.IntegerField()

    def validate_assignedTo(self, attrs, source):
        value = attrs[source]
        if value and value.type is User and not self.context['project'].member_set.filter(
                user_id=value.id).exists():
            raise serializers.ValidationError(
                'Cannot assign to non-team member')

        if value and value.type is Team and not self.context['project'].teams.filter(
                id=value.id).exists():
            raise serializers.ValidationError(
                'Cannot assign to a team without access to the project')

        return attrs

    def validate(self, attrs):
        attrs = super(GroupValidator, self).validate(attrs)
        if len(attrs) > 1 and 'discard' in attrs:
            raise serializers.ValidationError(
                'Other attributes cannot be updated when discarding')
        return attrs


class ProjectGroupIndexEndpoint(ProjectEndpoint, EnvironmentMixin):
    doc_section = DocSection.EVENTS

    permission_classes = (ProjectEventPermission, )

    def _build_query_params_from_request(self, request, project):
        query_kwargs = {
            'project': project,
            'sort_by': request.GET.get('sort', DEFAULT_SORT_OPTION),
        }

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
            try:
                query_kwargs.update(parse_query(project, query, request.user))
            except InvalidQuery as e:
                raise ValidationError(
                    u'Your search query could not be parsed: {}'.format(
                        e.message)
                )

        return query_kwargs

    def _search(self, request, project, extra_query_kwargs=None):
        query_kwargs = self._build_query_params_from_request(request, project)
        if extra_query_kwargs is not None:
            assert 'environment' not in extra_query_kwargs
            query_kwargs.update(extra_query_kwargs)

        try:
            query_kwargs['environment'] = self._get_environment_from_request(
                request,
                project.organization_id,
            )
        except Environment.DoesNotExist:
            # XXX: The 1000 magic number for `max_hits` is an abstraction leak
            # from `sentry.api.paginator.BasePaginator.get_result`.
            result = CursorResult([], None, None, hits=0, max_hits=1000)
        else:
            result = search.query(**query_kwargs)
        return result, query_kwargs

    def _subscribe_and_assign_issue(self, acting_user, group, result):
        if acting_user:
            GroupSubscription.objects.subscribe(
                user=acting_user,
                group=group,
                reason=GroupSubscriptionReason.status_change,
            )
            self_assign_issue = UserOption.objects.get_value(
                user=acting_user, key='self_assign_issue', default='0'
            )
            if self_assign_issue == '1' and not group.assignee_set.exists():
                result['assignedTo'] = Actor(type=User, id=extract_lazy_object(acting_user).id)

    # statsPeriod=24h
    @attach_scenarios([list_project_issues_scenario])
    def get(self, request, project):
        """
        List a Project's Issues
        ```````````````````````

        Return a list of issues (groups) bound to a project.  All parameters are
        supplied as query string parameters.

        A default query of ``is:unresolved`` is applied. To return results
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
                                    to return an event issue of a different
                                    project which is why this is an opt-in.
                                    Set to `1` to enable.
        :qparam querystring query: an optional Sentry structured search
                                   query.  If not provided an implied
                                   ``"is:unresolved"`` is assumed.)
        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :pparam string project_slug: the slug of the project the issues
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

        serializer = functools.partial(
            StreamGroupSerializer,
            environment_func=self._get_environment_func(request, project.organization_id),
            stats_period=stats_period,
        )

        query = request.GET.get('query', '').strip()
        if query:
            matching_group = None
            matching_event = None
            if len(query) == 32:
                # check to see if we've got an event ID
                try:
                    matching_group = Group.objects.from_event_id(project, query)
                except Group.DoesNotExist:
                    pass
                else:
                    try:
                        matching_event = Event.objects.get(
                            event_id=query, project_id=project.id)
                    except Event.DoesNotExist:
                        pass
                    else:
                        Event.objects.bind_nodes([matching_event], 'data')

            # If the query looks like a short id, we want to provide some
            # information about where that is.  Note that this can return
            # results for another project.  The UI deals with this.
            elif request.GET.get('shortIdLookup') == '1' and \
                    looks_like_short_id(query):
                try:
                    matching_group = Group.objects.by_qualified_short_id(
                        project.organization_id, query
                    )
                except Group.DoesNotExist:
                    matching_group = None

            if matching_group is not None:
                matching_event_environment = None

                try:
                    matching_event_environment = matching_event.get_environment().name if matching_event else None
                except Environment.DoesNotExist:
                    pass

                response = Response(
                    serialize(
                        [matching_group], request.user, serializer(
                            matching_event_id=getattr(matching_event, 'id', None),
                            matching_event_environment=matching_event_environment,
                        )
                    )
                )
                response['X-Sentry-Direct-Hit'] = '1'
                return response

        try:
            cursor_result, query_kwargs = self._search(request, project, {'count_hits': True})
        except ValidationError as exc:
            return Response({'detail': six.text_type(exc)}, status=400)

        results = list(cursor_result)

        context = serialize(results, request.user, serializer())

        # HACK: remove auto resolved entries
        if query_kwargs.get('status') == GroupStatus.UNRESOLVED:
            context = [r for r in context if r['status'] == 'unresolved']

        response = Response(context)

        self.add_cursor_headers(request, response, cursor_result)

        if results and query not in SAVED_SEARCH_QUERIES:
            advanced_search.send(project=project, sender=request.user)
            analytics.record('project_issue.searched', user_id=request.user.id,
                             organization_id=project.organization_id, project_id=project.id,
                             query=query)

        return response

    @attach_scenarios([bulk_update_issues_scenario])
    def put(self, request, project):
        """
        Bulk Mutate a List of Issues
        ````````````````````````````

        Bulk mutate various attributes on issues.  The list of issues
        to modify is given through the `id` query parameter.  It is repeated
        for each issue that should be modified.

        - For non-status updates, the `id` query parameter is required.
        - For status updates, the `id` query parameter may be omitted
          for a batch "update all" query.
        - An optional `status` query parameter may be used to restrict
          mutations to only events with the given status.

        The following attributes can be modified and are supplied as
        JSON object in the body:

        If any ids are out of scope this operation will succeed without
        any data mutation.

        :qparam int id: a list of IDs of the issues to be mutated.  This
                        parameter shall be repeated for each issue.  It
                        is optional only if a status is mutated in which
                        case an implicit `update all` is assumed.
        :qparam string status: optionally limits the query to issues of the
                               specified status.  Valid values are
                               ``"resolved"``, ``"unresolved"`` and
                               ``"ignored"``.
        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :pparam string project_slug: the slug of the project the issues
                                     belong to.
        :param string status: the new status for the issues.  Valid values
                              are ``"resolved"``, ``"resolvedInNextRelease"``,
                              ``"unresolved"``, and ``"ignored"``.
        :param int ignoreDuration: the number of minutes to ignore this issue.
        :param boolean isPublic: sets the issue to public or private.
        :param boolean merge: allows to merge or unmerge different issues.
        :param string assignedTo: the actor id (or username) of the user or team that should be
                                  assigned to this issue.
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
            group_list = Group.objects.filter(
                project=project, id__in=group_ids)
            # filter down group ids to only valid matches
            group_ids = [g.id for g in group_list]
            if not group_ids:
                return Response(status=204)
        else:
            group_list = None

        serializer = GroupValidator(
            data=request.DATA,
            partial=True,
            context={'project': project},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        result = dict(serializer.object)

        acting_user = request.user if request.user.is_authenticated() else None

        if not group_ids:
            try:
                # bulk mutations are limited to 1000 items
                # TODO(dcramer): it'd be nice to support more than this, but its
                # a bit too complicated right now
                cursor_result, _ = self._search(request, project, {
                    'limit': 1000,
                    'paginator_options': {'max_limit': 1000},
                })
            except ValidationError as exc:
                return Response({'detail': six.text_type(exc)}, status=400)

            group_list = list(cursor_result)
            group_ids = [g.id for g in group_list]

        is_bulk = len(group_ids) > 1

        queryset = Group.objects.filter(
            id__in=group_ids,
        )

        discard = result.get('discard')
        if discard:

            if not features.has('projects:discard-groups', project, actor=request.user):
                return Response({'detail': ['You do not have that feature enabled']}, status=400)

            group_list = list(queryset)
            groups_to_delete = []

            for group in group_list:
                with transaction.atomic():
                    try:
                        tombstone = GroupTombstone.objects.create(
                            previous_group_id=group.id,
                            actor_id=acting_user.id if acting_user else None,
                            **{name: getattr(group, name) for name in TOMBSTONE_FIELDS_FROM_GROUP}
                        )
                    except IntegrityError:
                        # in this case, a tombstone has already been created
                        # for a group, so no hash updates are necessary
                        pass
                    else:
                        groups_to_delete.append(group)

                        GroupHash.objects.filter(
                            group=group,
                        ).update(
                            group=None,
                            group_tombstone_id=tombstone.id,
                        )

            self._delete_groups(request, project, groups_to_delete, delete_type='discard')

            return Response(status=204)

        statusDetails = result.pop('statusDetails', result)
        status = result.get('status')
        if status in ('resolved', 'resolvedInNextRelease'):
            if status == 'resolvedInNextRelease' or statusDetails.get('inNextRelease'):
                release = Release.objects.filter(
                    projects=project,
                    organization_id=project.organization_id,
                ).extra(select={
                    'sort': 'COALESCE(date_released, date_added)',
                }).order_by('-sort')[0]
                activity_type = Activity.SET_RESOLVED_IN_RELEASE
                activity_data = {
                    # no version yet
                    'version': '',
                }
                status_details = {
                    'inNextRelease': True,
                    'actor': serialize(extract_lazy_object(request.user), request.user),
                }
                res_type = GroupResolution.Type.in_next_release
                res_type_str = 'in_next_release'
                res_status = GroupResolution.Status.pending
            elif statusDetails.get('inRelease'):
                release = statusDetails['inRelease']
                activity_type = Activity.SET_RESOLVED_IN_RELEASE
                activity_data = {
                    # no version yet
                    'version': release.version,
                }
                status_details = {
                    'inRelease': release.version,
                    'actor': serialize(extract_lazy_object(request.user), request.user),
                }
                res_type = GroupResolution.Type.in_release
                res_type_str = 'in_release'
                res_status = GroupResolution.Status.resolved
            else:
                release = None
                res_type_str = 'now'
                activity_type = Activity.SET_RESOLVED
                activity_data = {}
                status_details = {}

            now = timezone.now()

            for group in group_list:
                with transaction.atomic():
                    if release:
                        resolution_params = {
                            'release': release,
                            'type': res_type,
                            'status': res_status,
                            'actor_id': request.user.id
                            if request.user.is_authenticated() else None,
                        }
                        resolution, created = GroupResolution.objects.get_or_create(
                            group=group,
                            defaults=resolution_params,
                        )
                        if not created:
                            resolution.update(
                                datetime=timezone.now(), **resolution_params)
                    else:
                        resolution = None

                    affected = Group.objects.filter(
                        id=group.id,
                    ).update(
                        status=GroupStatus.RESOLVED,
                        resolved_at=now,
                    )
                    if not resolution:
                        created = affected

                    group.status = GroupStatus.RESOLVED
                    group.resolved_at = now

                    self._subscribe_and_assign_issue(
                        acting_user, group, result)

                    if created:
                        activity = Activity.objects.create(
                            project=group.project,
                            group=group,
                            type=activity_type,
                            user=acting_user,
                            ident=resolution.id if resolution else None,
                            data=activity_data,
                        )
                        # TODO(dcramer): we need a solution for activity rollups
                        # before sending notifications on bulk changes
                        if not is_bulk:
                            activity.send_notification()

                issue_resolved_in_release.send_robust(
                    group=group,
                    project=project,
                    user=acting_user,
                    resolution_type=res_type_str,
                    sender=self.__class__,
                )

                kick_off_status_syncs.apply_async(kwargs={
                    'project_id': group.project_id,
                    'group_id': group.id,
                })

            result.update({
                'status': 'resolved',
                'statusDetails': status_details,
            })

        elif status:
            new_status = STATUS_CHOICES[result['status']]

            with transaction.atomic():
                happened = queryset.exclude(
                    status=new_status,
                ).update(
                    status=new_status,
                )

                GroupResolution.objects.filter(
                    group__in=group_ids,
                ).delete()

                if new_status == GroupStatus.IGNORED:
                    ignore_duration = (
                        statusDetails.pop('ignoreDuration', None) or
                        statusDetails.pop('snoozeDuration', None)
                    ) or None
                    ignore_count = statusDetails.pop(
                        'ignoreCount', None) or None
                    ignore_window = statusDetails.pop(
                        'ignoreWindow', None) or None
                    ignore_user_count = statusDetails.pop(
                        'ignoreUserCount', None) or None
                    ignore_user_window = statusDetails.pop(
                        'ignoreUserWindow', None) or None
                    if ignore_duration or ignore_count or ignore_user_count:
                        if ignore_duration:
                            ignore_until = timezone.now() + timedelta(
                                minutes=ignore_duration,
                            )
                        else:
                            ignore_until = None
                        for group in group_list:
                            state = {}
                            if ignore_count and not ignore_window:
                                state['times_seen'] = group.times_seen
                            if ignore_user_count and not ignore_user_window:
                                state['users_seen'] = group.count_users_seen()
                            GroupSnooze.objects.create_or_update(
                                group=group,
                                values={
                                    'until':
                                    ignore_until,
                                    'count':
                                    ignore_count,
                                    'window':
                                    ignore_window,
                                    'user_count':
                                    ignore_user_count,
                                    'user_window':
                                    ignore_user_window,
                                    'state':
                                    state,
                                    'actor_id':
                                    request.user.id if request.user.is_authenticated() else None,
                                }
                            )
                            result['statusDetails'] = {
                                'ignoreCount': ignore_count,
                                'ignoreUntil': ignore_until,
                                'ignoreUserCount': ignore_user_count,
                                'ignoreUserWindow': ignore_user_window,
                                'ignoreWindow': ignore_window,
                                'actor': serialize(extract_lazy_object(request.user), request.user),
                            }
                        issue_ignored.send_robust(project=project, sender=self.__class__)
                    else:
                        GroupSnooze.objects.filter(
                            group__in=group_ids,
                        ).delete()
                        ignore_until = None
                        result['statusDetails'] = {}
                else:
                    result['statusDetails'] = {}

            if group_list and happened:
                if new_status == GroupStatus.UNRESOLVED:
                    activity_type = Activity.SET_UNRESOLVED
                    activity_data = {}
                elif new_status == GroupStatus.IGNORED:
                    activity_type = Activity.SET_IGNORED
                    activity_data = {
                        'ignoreCount': ignore_count,
                        'ignoreDuration': ignore_duration,
                        'ignoreUntil': ignore_until,
                        'ignoreUserCount': ignore_user_count,
                        'ignoreUserWindow': ignore_user_window,
                        'ignoreWindow': ignore_window,
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

                    if new_status == GroupStatus.UNRESOLVED:
                        kick_off_status_syncs.apply_async(kwargs={
                            'project_id': group.project_id,
                            'group_id': group.id,
                        })

        if 'assignedTo' in result:
            assigned_actor = result['assignedTo']
            if assigned_actor:
                for group in group_list:
                    resolved_actor = assigned_actor.resolve()

                    GroupAssignee.objects.assign(group, resolved_actor, acting_user)
                result['assignedTo'] = serialize(
                    assigned_actor.resolve(), acting_user, ActorSerializer())
            else:
                for group in group_list:
                    GroupAssignee.objects.deassign(group, acting_user)

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
                # NOTE: Subscribing without an initiating event (assignment,
                # commenting, etc.) clears out the previous subscription reason
                # to avoid showing confusing messaging as a result of this
                # action. It'd be jarring to go directly from "you are not
                # subscribed" to "you were subscribed due since you were
                # assigned" just by clicking the "subscribe" button (and you
                # may no longer be assigned to the issue anyway.)
                GroupSubscription.objects.create_or_update(
                    user=acting_user,
                    group=group,
                    project=project,
                    values={
                        'is_active': is_subscribed,
                        'reason': GroupSubscriptionReason.unknown,
                    },
                )

            result['subscriptionDetails'] = {
                'reason': SUBSCRIPTION_REASON_MAP.get(
                    GroupSubscriptionReason.unknown,
                    'unknown',
                ),
            }

        if 'isPublic' in result:
            # We always want to delete an existing share, because triggering
            # an isPublic=True even when it's already public, should trigger
            # regenerating.
            for group in group_list:
                if GroupShare.objects.filter(group=group).delete():
                    result['shareId'] = None
                    Activity.objects.create(
                        project=group.project,
                        group=group,
                        type=Activity.SET_PRIVATE,
                        user=acting_user,
                    )

        if result.get('isPublic'):
            for group in group_list:
                share, created = GroupShare.objects.get_or_create(
                    project=group.project,
                    group=group,
                    user=acting_user,
                )
                if created:
                    result['shareId'] = share.uuid
                    Activity.objects.create(
                        project=group.project,
                        group=group,
                        type=Activity.SET_PUBLIC,
                        user=acting_user,
                    )

        # XXX(dcramer): this feels a bit shady like it should be its own
        # endpoint
        if result.get('merge') and len(group_list) > 1:
            primary_group = sorted(group_list, key=lambda x: -x.times_seen)[0]
            children = []
            transaction_id = uuid4().hex
            for group in group_list:
                if group == primary_group:
                    continue
                children.append(group)
                group.update(status=GroupStatus.PENDING_MERGE)
                merge_group.delay(
                    from_object_id=group.id,
                    to_object_id=primary_group.id,
                    transaction_id=transaction_id,
                )

            Activity.objects.create(
                project=primary_group.project,
                group=primary_group,
                type=Activity.MERGE,
                user=acting_user,
                data={
                    'issues': [{
                        'id': c.id
                    } for c in children],
                },
            )

            result['merge'] = {
                'parent': six.text_type(primary_group.id),
                'children': [six.text_type(g.id) for g in children],
            }

        return Response(result)

    @attach_scenarios([bulk_remove_issues_scenario])
    def delete(self, request, project):
        """
        Bulk Remove a List of Issues
        ````````````````````````````

        Permanently remove the given issues. The list of issues to
        modify is given through the `id` query parameter.  It is repeated
        for each issue that should be removed.

        Only queries by 'id' are accepted.

        If any ids are out of scope this operation will succeed without
        any data mutation.

        :qparam int id: a list of IDs of the issues to be removed.  This
                        parameter shall be repeated for each issue.
        :pparam string organization_slug: the slug of the organization the
                                          issues belong to.
        :pparam string project_slug: the slug of the project the issues
                                     belong to.
        :auth: required
        """
        group_ids = request.GET.getlist('id')
        if group_ids:
            group_list = list(
                Group.objects.filter(
                    project=project,
                    id__in=set(group_ids),
                ).exclude(
                    status__in=[
                        GroupStatus.PENDING_DELETION,
                        GroupStatus.DELETION_IN_PROGRESS,
                    ]
                )
            )
        else:
            try:
                # bulk mutations are limited to 1000 items
                # TODO(dcramer): it'd be nice to support more than this, but its
                # a bit too complicated right now
                cursor_result, _ = self._search(request, project, {
                    'limit': 1000,
                    'paginator_options': {'max_limit': 1000},
                })
            except ValidationError as exc:
                return Response({'detail': six.text_type(exc)}, status=400)

            group_list = list(cursor_result)

        if not group_list:
            return Response(status=204)

        self._delete_groups(request, project, group_list, delete_type='delete')

        return Response(status=204)

    def _delete_groups(self, request, project, group_list, delete_type):
        group_ids = [g.id for g in group_list]

        Group.objects.filter(
            id__in=group_ids,
        ).exclude(status__in=[
            GroupStatus.PENDING_DELETION,
            GroupStatus.DELETION_IN_PROGRESS,
        ]).update(status=GroupStatus.PENDING_DELETION)

        eventstream.delete_groups(project.id, group_ids)

        GroupHashTombstone.tombstone_groups(
            project_id=project.id,
            group_ids=group_ids,
        )

        transaction_id = uuid4().hex

        for group in group_list:
            delete_group.apply_async(
                kwargs={
                    'object_id': group.id,
                    'transaction_id': transaction_id,
                },
                countdown=3600,
            )

            self.create_audit_entry(
                request=request,
                organization_id=project.organization_id,
                target_object=group.id,
                transaction_id=transaction_id,
            )

            delete_logger.info(
                'object.delete.queued',
                extra={
                    'object_id': group.id,
                    'transaction_id': transaction_id,
                    'model': type(group).__name__,
                }
            )

            issue_deleted.send_robust(
                group=group,
                user=request.user,
                delete_type=delete_type,
                sender=self.__class__)
