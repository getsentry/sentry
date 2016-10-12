from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api import client
from sentry.api.base import DocSection
from sentry.api.bases import GroupEndpoint
from sentry.api.fields import UserField
from sentry.api.serializers import serialize
from sentry.constants import STATUS_CHOICES
from sentry.models import (
    Activity, Group, GroupHash, GroupAssignee, GroupSeen, GroupSubscription,
    GroupSubscriptionReason, GroupStatus, GroupTagKey, GroupTagValue, Release,
    User, UserReport,
)
from sentry.plugins import IssueTrackingPlugin2, plugins
from sentry.utils.safe import safe_execute
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('RetrieveAggregate')
def retrieve_aggregate_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/issues/%s/' % group.id,
    )


@scenario('UpdateAggregate')
def update_aggregate_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='PUT',
        path='/issues/%s/' % group.id,
        data={'status': 'unresolved'}
    )


@scenario('DeleteAggregate')
def delete_aggregate_scenario(runner):
    with runner.isolated_project('Boring Mushrooms') as project:
        group = Group.objects.filter(project=project).first()
        runner.request(
            method='DELETE',
            path='/issues/%s/' % group.id,
        )


class GroupSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=zip(
        STATUS_CHOICES.keys(), STATUS_CHOICES.keys()
    ))
    isBookmarked = serializers.BooleanField()
    isSubscribed = serializers.BooleanField()
    hasSeen = serializers.BooleanField()
    assignedTo = UserField()
    ignoreDuration = serializers.IntegerField()

    # TODO(dcramer): remove in 9.0
    snoozeDuration = serializers.IntegerField()


class GroupDetailsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def _get_activity(self, request, group, num):
        activity_items = set()
        activity = []
        activity_qs = Activity.objects.filter(
            group=group,
        ).order_by('-datetime').select_related('user')
        # we select excess so we can filter dupes
        for item in activity_qs[:num * 2]:
            sig = (item.type, item.ident, item.user_id)
            # TODO: we could just generate a signature (hash(text)) for notes
            # so there's no special casing
            if item.type == Activity.NOTE:
                activity.append(item)
            elif sig not in activity_items:
                activity_items.add(sig)
                activity.append(item)

        activity.append(Activity(
            project=group.project,
            group=group,
            type=Activity.FIRST_SEEN,
            datetime=group.first_seen,
        ))

        return activity[:num]

    def _get_seen_by(self, request, group):
        seen_by = list(GroupSeen.objects.filter(
            group=group
        ).select_related('user').order_by('-last_seen'))
        return serialize(seen_by, request.user)

    def _get_actions(self, request, group):
        project = group.project

        action_list = []
        for plugin in plugins.for_project(project, version=1):
            results = safe_execute(plugin.actions, request, group, action_list,
                                   _with_transaction=False)

            if not results:
                continue

            action_list = results

        for plugin in plugins.for_project(project, version=2):
            for action in (safe_execute(plugin.get_actions, request, group,
                                        _with_transaction=False) or ()):
                action_list.append(action)

        return action_list

    def _get_available_issue_plugins(self, request, group):
        project = group.project

        plugin_issues = []
        for plugin in plugins.for_project(project, version=1):
            if isinstance(plugin, IssueTrackingPlugin2):
                plugin_issues = safe_execute(plugin.plugin_issues, request, group, plugin_issues,
                                             _with_transaction=False)
        return plugin_issues

    def _get_release_info(self, request, group, version):
        try:
            release = Release.objects.get(
                project=group.project,
                version=version,
            )
        except Release.DoesNotExist:
            return {'version': version}
        return serialize(release, request.user)

    @attach_scenarios([retrieve_aggregate_scenario])
    def get(self, request, group):
        """
        Retrieve an Issue
        `````````````````

        Return details on an individual issue. This returns the basic stats for
        the issue (title, last seen, first seen), some overall numbers (number
        of comments, user reports) as well as the summarized event data.

        :pparam string issue_id: the ID of the issue to retrieve.
        :auth: required
        """
        # TODO(dcramer): handle unauthenticated/public response
        data = serialize(group, request.user)

        # TODO: these probably should be another endpoint
        activity = self._get_activity(request, group, num=100)
        seen_by = self._get_seen_by(request, group)

        # find first seen release
        if group.first_release is None:
            try:
                first_release = GroupTagValue.objects.filter(
                    group=group,
                    key__in=('sentry:release', 'release'),
                ).order_by('first_seen')[0]
            except IndexError:
                first_release = None
            else:
                first_release = first_release.value
        else:
            first_release = group.first_release.version

        if first_release is not None:
            # find last seen release
            try:
                last_release = GroupTagValue.objects.filter(
                    group=group,
                    key__in=('sentry:release', 'release'),
                ).order_by('-last_seen')[0]
            except IndexError:
                last_release = None
            else:
                last_release = last_release.value
        else:
            last_release = None

        action_list = self._get_actions(request, group)

        now = timezone.now()
        hourly_stats = tsdb.rollup(tsdb.get_range(
            model=tsdb.models.group,
            keys=[group.id],
            end=now,
            start=now - timedelta(days=1),
        ), 3600)[group.id]
        daily_stats = tsdb.rollup(tsdb.get_range(
            model=tsdb.models.group,
            keys=[group.id],
            end=now,
            start=now - timedelta(days=30),
        ), 3600 * 24)[group.id]

        if first_release:
            first_release = self._get_release_info(request, group, first_release)
        if last_release:
            last_release = self._get_release_info(request, group, last_release)

        tags = list(GroupTagKey.objects.filter(
            group=group,
        )[:100])

        participants = list(User.objects.filter(
            groupsubscription__is_active=True,
            groupsubscription__group=group,
        ))

        data.update({
            'firstRelease': first_release,
            'lastRelease': last_release,
            'activity': serialize(activity, request.user),
            'seenBy': seen_by,
            'participants': serialize(participants, request.user),
            'pluginActions': action_list,
            'pluginIssues': self._get_available_issue_plugins(request, group),
            'userReportCount': UserReport.objects.filter(group=group).count(),
            'tags': sorted(serialize(tags, request.user), key=lambda x: x['name']),
            'stats': {
                '24h': hourly_stats,
                '30d': daily_stats,
            }
        })

        return Response(data)

    @attach_scenarios([update_aggregate_scenario])
    def put(self, request, group):
        """
        Update an Issue
        ```````````````

        Updates an individual issues's attributes.  Only the attributes
        submitted are modified.

        :pparam string issue_id: the ID of the group to retrieve.
        :param string status: the new status for the groups.  Valid values
                              are ``"resolved"``, ``"unresolved"`` and
                              ``"ignored"``.
        :param string assignedTo: the username of the user that should be
                               assigned to this issue.
        :param boolean hasSeen: in case this API call is invoked with a user
                                context this allows changing of the flag
                                that indicates if the user has seen the
                                event.
        :param boolean isBookmarked: in case this API call is invoked with a
                                     user context this allows changing of
                                     the bookmark flag.
        :param boolean isSubscribed:
        :auth: required
        """
        # TODO(dcramer): we need to implement assignedTo in the bulk mutation
        # endpoint
        serializer = GroupSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object
        acting_user = request.user if request.user.is_authenticated() else None

        if result.get('assignedTo') and not group.project.member_set.filter(user=result['assignedTo']).exists():
            return Response({'detail': 'Cannot assign to non-team member'}, status=400)

        if 'assignedTo' in result:
            if result['assignedTo']:
                GroupAssignee.objects.assign(group, result['assignedTo'],
                                             acting_user)

                if 'isSubscribed' not in result or result['assignedTo'] != request.user:
                    GroupSubscription.objects.subscribe(
                        group=group,
                        user=result['assignedTo'],
                        reason=GroupSubscriptionReason.assigned,
                    )
            else:
                GroupAssignee.objects.deassign(group, acting_user)

        response = client.put(
            path='/projects/{}/{}/issues/'.format(
                group.project.organization.slug,
                group.project.slug,
            ),
            params={
                'id': group.id,
            },
            data=request.DATA,
            request=request,
        )

        # we need to fetch the object against as the bulk mutation endpoint
        # only returns a delta, and object mutation returns a complete updated
        # entity.
        # TODO(dcramer): we should update the API and have this be an explicit
        # flag (or remove it entirely) so that delta's are the primary response
        # for mutation.
        group = Group.objects.get(id=group.id)

        return Response(serialize(group, request.user),
                        status=response.status_code)

    @attach_scenarios([delete_aggregate_scenario])
    def delete(self, request, group):
        """
        Remove an Issue
        ```````````````

        Removes an individual issue.

        :pparam string issue_id: the ID of the issue to delete.
        :auth: required
        """
        from sentry.tasks.deletion import delete_group

        updated = Group.objects.filter(
            id=group.id,
        ).exclude(
            status__in=[
                GroupStatus.PENDING_DELETION,
                GroupStatus.DELETION_IN_PROGRESS,
            ]
        ).update(status=GroupStatus.PENDING_DELETION)
        if updated:
            GroupHash.objects.filter(group=group).delete()
            delete_group.apply_async(
                kwargs={'object_id': group.id},
                countdown=3600,
            )

        return Response(status=202)
